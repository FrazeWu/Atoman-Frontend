import {StreamLanguage,HighlightStyle,syntaxHighlighting,bracketMatching,indentOnInput} from '@codemirror/language'
import {autocompletion,closeBrackets,closeBracketsKeymap,type CompletionContext,type CompletionResult,type Completion} from '@codemirror/autocomplete'
import {tags} from '@lezer/highlight'
import {keymap} from '@codemirror/view'
import {search,searchKeymap} from '@codemirror/search'
import {latexCode,latexSymbolsFromCode,MAX_LATEX_SYMBOLS,type LatexSymbol,type LatexFile} from './latexSymbols'

const language=StreamLanguage.define({
 token(stream){
  if(stream.eatSpace())return null
  if(stream.peek()==='%'){stream.skipToEnd();return 'comment'}
  if(stream.match(/^\\(?:begin|end|section|subsection|subsubsection|chapter|part|paragraph|documentclass|usepackage)\b/))return 'definitionKeyword'
  if(stream.match(/^\\(?:[A-Za-z@]+\*?|.)/))return 'keyword'
  if(stream.match(/^[{}\[\]()]/))return 'bracket'
  if(stream.match(/^\$+|^&|^[_^]/))return 'operator'
  stream.next();return null
 },
 languageData:{commentTokens:{line:'%'},closeBrackets:{brackets:['(','[','{']}}
})
const highlights=HighlightStyle.define([
 {tag:tags.keyword,color:'var(--papers-command,#2158a1)'},
 {tag:tags.definitionKeyword,color:'var(--papers-definition,#8048a3)',fontWeight:'600'},
 {tag:tags.comment,color:'var(--papers-comment,#637d58)',fontStyle:'italic'},
 {tag:tags.bracket,color:'var(--papers-bracket,#9d6023)'},
 {tag:tags.operator,color:'var(--papers-operator,#a2538d)'}
])
const commands=['documentclass','usepackage','begin','end','title','author','date','maketitle','abstract','section','subsection','subsubsection','paragraph','chapter','appendix','label','ref','eqref','pageref','autoref','cref','Cref','cite','citep','citet','parencite','textcite','autocite','citeauthor','citeyear','nocite','bibitem','bibliography','bibliographystyle','addbibresource','printbibliography','input','include','includeonly','subfile','includegraphics','graphicspath','caption','textbf','textit','emph','texttt','footnote','url','href','frac','dfrac','sqrt','sum','prod','int','mathbb','mathbf','mathcal','mathrm','operatorname','left','right','alpha','beta','gamma','delta','lambda','theta','sigma','toprule','midrule','bottomrule','multicolumn','multirow','hline','item','newcommand','renewcommand','providecommand','newenvironment','newtheorem','DeclareMathOperator','textcolor','ensuremath','setlength','linewidth','textwidth','centering','hspace','vspace','noindent','phantom','times','cdot','infty','partial','nabla','leq','geq','neq','approx','rightarrow','forall','exists']
const environments=['document','abstract','figure','figure*','table','table*','tabular','tabularx','equation','equation*','align','align*','aligned','gather','multline','itemize','enumerate','description','algorithm','algorithmic','algorithmicx','proof','theorem','lemma','definition','proposition','corollary','minipage','center','quote','verbatim','thebibliography']
type CompletionKind='command'|'environment'|'label'|'citation'|'path'
interface LatexCompletionQuery{kind:CompletionKind;from:number;start:number;prefix:string;command?:string;insertSlash?:boolean}
export interface LatexCompletionOptions{
 citations?:()=>readonly string[]
 files?:()=>readonly LatexFile[]
 path?:()=>string
 projectSymbols?:(refresh:boolean)=>readonly LatexSymbol[]|Promise<readonly LatexSymbol[]>
}

// Match only the current literal argument, including optional citation and
// graphics arguments. Keep earlier comma-separated values and closing braces.
const argument=/\\([A-Za-z@]+)\*?\s*(?:\[[^\]\r\n]{0,512}\]\s*){0,2}\{([^{}\r\n]*)$/
const citeCommands=/^(?:cite[A-Za-z]*|Cite[A-Za-z]*|parencite|textcite|autocite|nocite|footcite|smartcite)$/
const refCommands=/^(?:ref|eqref|pageref|autoref|nameref|cref|Cref|vref|Vref)$/
const pathCommands=/^(?:input|include|includeonly|subfile|includegraphics|bibliography|addbibresource|usepackage|RequirePackage|documentclass|lstinputlisting)$/
export function latexCompletionQuery(context:CompletionContext):LatexCompletionQuery|null{
 if(context.state.readOnly)return null
 const line=context.state.doc.lineAt(context.pos)
 const raw=line.text.slice(0,context.pos-line.from)
 if(raw.length>8192)return null
 const code=latexCode(raw)
 const arg=argument.exec(code)
 if(arg&&raw.slice(arg.index)===code.slice(arg.index)){
  let preceding=0
  for(let n=arg.index-1;n>=0&&code[n]==='\\';n--)preceding++
  if(preceding%2)return null
  const command=arg[1]!,tail=arg[2]!
  let kind:CompletionKind|undefined
  if(command==='begin'||command==='end')kind='environment'
  else if(citeCommands.test(command))kind='citation'
  else if(refCommands.test(command))kind='label'
  else if(pathCommands.test(command))kind='path'
  if(kind){
   const prefix=tail.slice(tail.lastIndexOf(',')+1).trimStart()
   if(/[\\{}%#\r\n]/.test(prefix)||prefix.length>256)return null
   return {kind,from:context.pos-prefix.length,start:line.from+arg.index,prefix,command}
  }
 }
 const cmd=/\\([A-Za-z@]*)$/.exec(code)
 if(cmd&&raw.slice(cmd.index)===code.slice(cmd.index)){
  // A doubled backslash is a TeX line break, not a command prefix.
  let preceding=0
  for(let n=cmd.index-1;n>=0&&code[n]==='\\';n--)preceding++
  if(preceding%2)return null
  return {kind:'command',from:context.pos-cmd[1]!.length,start:line.from+cmd.index,prefix:cmd[1]!}
 }
 if(context.explicit&&code===raw&&(!raw||/\s$/.test(raw)))return {kind:'command',from:context.pos,start:Math.max(line.from,context.pos-1),prefix:'',insertSlash:true}
 return null
}

function fileCandidates(files:readonly LatexFile[],command:string):Completion[]{
 const out:Completion[]=[]
 for(const file of files.slice(0,100)){
  const path=file.path
  // Never suggest absolute paths, traversal, or a name requiring macro expansion.
  if(!path||path.length>256||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\{}%,#$&^~\r\n]/.test(path))continue
  let name=''
  if(/^(?:input|include|includeonly|subfile)$/.test(command)&&file.kind==='text'&&/\.tex$/i.test(path))name=path.replace(/\.tex$/i,'')
  else if(command==='includegraphics'&&file.kind==='binary'&&/\.(png|jpe?g|pdf)$/i.test(path))name=path
  else if(command==='bibliography'&&file.kind==='text'&&/\.bib$/i.test(path))name=path.replace(/\.bib$/i,'')
  else if(command==='addbibresource'&&file.kind==='text'&&/\.bib$/i.test(path))name=path
  else if(/^(?:usepackage|RequirePackage)$/.test(command)&&file.kind==='text'&&/\.sty$/i.test(path))name=path.replace(/\.sty$/i,'')
  else if(command==='documentclass'&&file.kind==='text'&&/\.cls$/i.test(path))name=path.replace(/\.cls$/i,'')
  else if(command==='lstinputlisting'&&file.kind==='text')name=path
  if(name)out.push({label:name,type:'text',detail:path===name?'项目文件':path})
 }
 return out
}

export function latexCompletionResult(query:LatexCompletionQuery,citations:readonly string[],files:readonly LatexFile[],symbols:readonly LatexSymbol[]):CompletionResult|null{
 const options:Completion[]=[],seen=new Set<string>()
 const add=(option:Completion)=>{if(!seen.has(option.label)&&options.length<MAX_LATEX_SYMBOLS){seen.add(option.label);options.push(option)}}
 if(query.kind==='path'){
  for(const option of fileCandidates(files,query.command||'')){
   add(option)
   // Both forms are legal for input; offer the extension from the start
   // so the cached completion list also works when the user types a dot.
   if(query.command==='input'||query.command==='subfile')add({...option,label:option.label+'.tex',boost:-2})
  }
 }else{
  if(query.kind==='command'){
   for(const label of commands)add({label,type:'keyword',...(query.insertSlash?{apply:'\\'+label}:{})})
  }else if(query.kind==='environment'){
   for(const label of environments)add({label,type:'type'})
  }else if(query.kind==='citation'){
   for(const label of citations)if(label&&label.length<=180&&!/[\\{}\s,%]/.test(label))add({label,type:'constant',detail:'BibTeX'})
  }
  for(const symbol of symbols){
   if(symbol.kind!==query.kind)continue
   add({label:symbol.name,type:query.kind==='command'?'function':query.kind==='environment'?'type':'constant',detail:symbol.path||'当前文件',boost:5,...(query.insertSlash?{apply:'\\'+symbol.name}:{})})
  }
 }
 if(!options.length)return null
 return {from:query.from,options,validFor:query.kind==='command'?/^[A-Za-z@]*$/:query.kind==='environment'?/^[A-Za-z0-9@*_-]*$/:query.kind==='path'?/^[^\\{}%,#\r\n]*$/:/^[^\\{}\s,%#]*$/}
}

export function latexExtensionsFor(input:LatexCompletionOptions|(()=>readonly string[])=()=>[]){
 const options=typeof input==='function'?{citations:input}:input
 let previousDoc:CompletionContext['state']['doc']|undefined,previousPath='',local:LatexSymbol[]=[],clean=''
 function source(context:CompletionContext){
  const query=latexCompletionQuery(context)
  if(!query)return null
  const path=options.path?.()||''
  // Avoid repeatedly scanning a large document for the same completion query.
  // CodeMirror's validFor filters subsequent keystrokes without new scans.
  if(previousDoc!==context.state.doc||previousPath!==path){
   previousDoc=context.state.doc;previousPath=path
   if(previousDoc.length<=1024*1024){
    const text=previousDoc.toString()
    clean=latexCode(text);local=latexSymbolsFromCode(clean,path)
   }else{clean='';local=[]}
  }
  // The literal argument itself must not be inside a comment or verbatim body.
  if(clean&&clean.slice(query.start,context.pos)!==context.state.doc.sliceString(query.start,context.pos))return null
  const localSymbols=local
  const result=(project:readonly LatexSymbol[])=>context.aborted?null:latexCompletionResult(query,options.citations?.()||[],options.files?.()||[],[...localSymbols,...project])
  if(query.kind==='path')return result([])
  // Automatically fetch cross-file symbols for reference arguments; explicit
  // completion also requests the project index for custom macros/environments.
  // Routine command typing only uses already indexed symbols.
  const other=options.projectSymbols?.(query.kind==='label'||query.kind==='citation'||context.explicit)||[]
  return other instanceof Promise?other.then(result,()=>result([])):result(other)
 }
 return [
  language,syntaxHighlighting(highlights),bracketMatching(),closeBrackets(),indentOnInput(),
  autocompletion({override:[source],activateOnTyping:true,maxRenderedOptions:60}),search({top:true}),
  keymap.of([...closeBracketsKeymap,...searchKeymap])
 ]
}

export const latexExtensions=latexExtensionsFor()

export type LatexHeading={title:string;level:number;line:number}
export function latexHeadings(source:string):LatexHeading[]{
 const levels:Record<string,number>={part:0,chapter:1,section:2,subsection:3,subsubsection:4,paragraph:5}
 const rows:LatexHeading[]=[]
 let verbatim=false
 for(const [i,line] of source.split('\n').entries()){
  let clean=''
  for(let j=0;j<line.length;j++){
   if(line[j]==='%'&&(j===0||line[j-1]!=='\\'))break
   clean+=line[j]
  }
  if(/\\begin\{(?:verbatim\*?|lstlisting|minted)\}/.test(clean))verbatim=true
  if(!verbatim){
   const re=/\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*(?:\[[^\]]*\]\s*)?\{/g
   let m:RegExpExecArray|null
   while((m=re.exec(clean))!==null&&rows.length<300){
    const start=re.lastIndex;let depth=1,j=start
    for(;j<clean.length;j++){
     if(clean[j]==='\\'){j++;continue}
     if(clean[j]==='{')depth++
     if(clean[j]==='}'&&--depth===0)break
     // Only closing braces decrement the nesting counter.
    }
    if(depth===0){const title=clean.slice(start,j).trim().slice(0,160);if(title)rows.push({title,level:levels[m[1]!]!,line:i+1});re.lastIndex=j+1}
   }
  }
  if(/\\end\{(?:verbatim\*?|lstlisting|minted)\}/.test(clean))verbatim=false
  if(rows.length>=300)break
 }
 return rows
}

// Recognize only the conventional, allowlisted TeX editor directive. This
// is a UI recommendation, never a command or a backend capability override.
export function recommendedTexCompiler(source:string):'pdflatex'|'xelatex'|'lualatex'|undefined{
 const match=source.slice(0,2048).match(/^\s*%\s*!\s*TEX\s+(?:program|TS-program)\s*=\s*(pdflatex|xelatex|lualatex)\s*$/im)
 return match?.[1]?.toLowerCase() as 'pdflatex'|'xelatex'|'lualatex'|undefined
}
