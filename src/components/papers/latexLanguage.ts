import {StreamLanguage,HighlightStyle,syntaxHighlighting,bracketMatching,indentOnInput} from '@codemirror/language'
import {autocompletion,closeBrackets,closeBracketsKeymap,type CompletionContext} from '@codemirror/autocomplete'
import {tags} from '@lezer/highlight'
import {keymap} from '@codemirror/view'
import {search,searchKeymap} from '@codemirror/search'

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
const commands=['documentclass','usepackage','begin','end','title','author','date','maketitle','abstract','section','subsection','subsubsection','paragraph','chapter','appendix','label','ref','eqref','autoref','cref','Cref','cite','citep','citet','bibliography','bibliographystyle','input','include','includegraphics','graphicspath','caption','textbf','textit','emph','texttt','footnote','url','href','frac','sqrt','sum','prod','int','mathbb','mathbf','mathcal','left','right','alpha','beta','gamma','delta','lambda','theta','sigma','toprule','midrule','bottomrule','multicolumn','multirow','hline','item','newcommand','renewcommand','newtheorem','textcolor']
const environments=['document','abstract','figure','figure*','table','table*','tabular','tabularx','equation','equation*','align','align*','gather','multline','itemize','enumerate','description','algorithm','algorithmic','proof','theorem','lemma','definition','minipage','center','quote','verbatim']
function complete(context:CompletionContext, citations:readonly string[]=[]){
 const cite=context.matchBefore(/\\(?:cite[a-zA-Z]*|parencite|textcite|autocite|nocite)\*?\{[^{}\n]*$/)
 if(cite){const tail=cite.text.slice(Math.max(cite.text.lastIndexOf('{'),cite.text.lastIndexOf(','))+1);const key=tail.trimStart();return {from:context.pos-key.length,options:citations.map(label=>({label,type:'constant'})),validFor:/^[^\s,{}%]*$/}}
 const env=context.matchBefore(/\\(?:begin|end)\{[A-Za-z*]*$/)
 if(env){const from=env.from+env.text.indexOf('{')+1;return {from,options:environments.map(label=>({label,type:'type'})),validFor:/^[A-Za-z*]*$/}}
 const cmd=context.matchBefore(/\\[A-Za-z@]*$/)
 if(!cmd)return null
 return {from:cmd.from+1,options:commands.map(label=>({label,type:'keyword'})),validFor:/^[A-Za-z@]*$/}
}
export function latexExtensionsFor(citations:()=>readonly string[]=()=>[]){return [
 language,syntaxHighlighting(highlights),bracketMatching(),closeBrackets(),indentOnInput(),
 autocompletion({override:[context=>complete(context,citations())],activateOnTyping:true}),search({top:true}),
 keymap.of([...closeBracketsKeymap,...searchKeymap])
]}
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
