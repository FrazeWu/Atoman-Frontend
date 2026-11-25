/** Original writing starters, not copies of conference style files. */
export type TemplateCompiler = 'pdflatex' | 'xelatex'
export type TemplateCategory = 'general' | 'conference' | 'chinese'
export interface PaperTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  compiler: TemplateCompiler
  sections: readonly string[]
  official?: { url: string; guidance: string }
  wide?: boolean
}
export const paperTemplateCategories = [
  { value: 'all', label: '全部' },
  { value: 'conference', label: '会议与期刊' },
  { value: 'general', label: '通用论文' },
  { value: 'chinese', label: '中文论文' },
] as const
export const paperTemplates: readonly PaperTemplate[] = [
  { id:'neurips-2026-draft',name:'NeurIPS 2026 写作稿',category:'conference',compiler:'pdflatex',
    description:'单栏英文研究稿，含实验、局限性与复现记录。',sections:['Introduction','Related Work','Method','Experiments','Limitations','Conclusion'],
    official:{url:'https://neurips.cc/Conferences/2026/MainTrackHandbook',guidance:'正式投稿须使用该届官方样式及检查清单；本稿不含官方样式。'} },
  { id:'acl-draft',name:'ACL / EMNLP 写作稿',category:'conference',compiler:'pdflatex',wide:true,
    description:'双栏 NLP 论文结构，预置局限性和伦理讨论。',sections:['Introduction','Related Work','Method','Experimental Setup','Results','Limitations','Ethics Statement','Conclusion'],
    official:{url:'https://github.com/acl-org/acl-style-files',guidance:'下载官方样式及 LaTeX 示例，通过 ZIP 或文件夹导入；正式投稿以目标会议要求为准。'} },
  { id:'icml-2026-draft',name:'ICML 2026 写作稿',category:'conference',compiler:'pdflatex',wide:true,
    description:'双栏机器学习研究稿，包含问题定义、实验与影响讨论。',sections:['Introduction','Problem Formulation','Method','Experiments','Related Work','Impact Statement','Conclusion'],
    official:{url:'https://icml.cc/Conferences/2026/AuthorInstructions',guidance:'正式投稿请下载作者指南中的当届 LaTeX 样式，使用官方示例创建项目。'} },
  { id:'ieee-draft',name:'IEEE 会议写作稿',category:'conference',compiler:'pdflatex',wide:true,
    description:'双栏工程论文草稿，含方法设计和性能评估。',sections:['Introduction','Related Work','System Design','Evaluation','Discussion','Conclusion'],
    official:{url:'https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/authoring-tools-and-templates/',guidance:'当前编译镜像未内置 IEEEtran；正式使用时请导入官方模板及所需类文件。'} },
  { id:'article',name:'英文研究论文',category:'general',compiler:'pdflatex',
    description:'通用单栏研究论文，含分章节源码与 BibTeX。',sections:['Introduction','Related Work','Method','Experiments','Conclusion'] },
  { id:'two-column',name:'英文双栏论文',category:'general',compiler:'pdflatex',wide:true,
    description:'通用双栏文章，适合技术报告和论文写作。',sections:['Introduction','Background','Approach','Evaluation','Conclusion'] },
  { id:'chinese-article',name:'中文科研论文',category:'chinese',compiler:'xelatex',
    description:'CTeX 中文文章，使用开源 Noto CJK 字体。',sections:['引言','相关工作','研究方法','实验与分析','结论'] },
  { id:'chinese-thesis',name:'中文学位论文通用稿',category:'chinese',compiler:'xelatex',
    description:'多章节学位论文结构，含封面、摘要、目录与致谢。',sections:['绪论','相关理论与技术','研究方法','实验与结果分析','总结与展望'] },
]
export const getPaperTemplate = (id:string) => paperTemplates.find(template=>template.id===id)

const bibliography = String.raw`% Replace this real example reference with your own bibliography.
@book{lamport1994latex,
  author    = {Leslie Lamport},
  title     = {LaTeX: A Document Preparation System},
  edition   = {2},
  publisher = {Addison-Wesley},
  year      = {1994}
}
`

function englishFiles(template:PaperTemplate):Record<string,string>{
  const files:Record<string,string>={}
  const sections=template.sections.map((title,index)=>{
    const path='sections/'+String(index+1).padStart(2,'0')+'-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-')
    files[path+'.tex']='\\section{'+title+'}\n'+(index===0?'Replace this paragraph with your research motivation and contributions. A sample citation is provided here \\cite{lamport1994latex}.\n':'% Write this section here.\n')
    return '\\input{'+path+'}'
  })
  files['main.tex']=(template.official?'% AToMAN original writing starter. NOT the official submission style.\n% Obtain the official style and check the current venue rules before submission.\n':'% AToMAN original writing starter.\n')+
    String.raw`\documentclass[`+(template.wide?'10pt,twocolumn':'11pt')+String.raw`]{article}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\title{Your Paper Title}
\author{Anonymous Authors}
\date{}
\begin{document}
\maketitle
\begin{abstract}
Summarize the problem, method, and main findings here.
\end{abstract}
`+'\n'+sections.join('\n')+'\n'+String.raw`\bibliographystyle{plain}
\bibliography{references}
\appendix
\section{Supplementary Details}
% Add proofs, reproducibility details, or additional results here.
\end{document}
`
  return files
}

function chineseFiles(template:PaperTemplate):Record<string,string>{
  const thesis=template.id==='chinese-thesis'
  const files:Record<string,string>={}
  const sections=template.sections.map((title,index)=>{
    const path='sections/chapter-'+String(index+1).padStart(2,'0')
    files[path+'.tex']='\\'+(thesis?'chapter':'section')+'{'+title+'}\n'+(index===0?'在此介绍研究背景、研究问题和主要贡献。示例引用见文献 \\cite{lamport1994latex}。\n':'% 在此撰写本章正文。\n')
    return '\\input{'+path+'}'
  })
  const preamble="% !TEX program = xelatex\n% \u539f\u521b\u901a\u7528\u5199\u4f5c\u7a3f\uff0c\u4e0d\u4ee3\u8868\u4efb\u4f55\u9ad8\u6821\u7684\u6b63\u5f0f\u6392\u7248\u89c4\u8303\u3002\n\\documentclass[UTF8,fontset=none]{"+(thesis?'ctexbook':'ctexart')+"}\n\\setCJKmainfont{Noto Serif CJK SC}\n\\setCJKsansfont{Noto Sans CJK SC}\n\\setCJKmonofont{Noto Sans Mono CJK SC}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{booktabs}\n\\usepackage{hyperref}\n\\title{\u8bba\u6587\u9898\u76ee}\n\\author{\u4f5c\u8005\u59d3\u540d}\n\\date{}\n\\begin{document}\n"
  const start=thesis?"\\frontmatter\n\\maketitle\n\\chapter*{\u6458\u8981}\n\u5728\u6b64\u64b0\u5199\u4e2d\u6587\u6458\u8981\u3002\n\n\\noindent \u5173\u952e\u8bcd\uff1a\u5173\u952e\u8bcd\u4e00\uff1b\u5173\u952e\u8bcd\u4e8c\n\\chapter*{Abstract}\nWrite the English abstract here.\n\n\\tableofcontents\n\\mainmatter\n":"\\maketitle\n\\begin{abstract}\n\u5728\u6b64\u6982\u8ff0\u7814\u7a76\u95ee\u9898\u3001\u65b9\u6cd5\u4e0e\u4e3b\u8981\u7ed3\u679c\u3002\n\n\\noindent \u5173\u952e\u8bcd\uff1a\u5173\u952e\u8bcd\u4e00\uff1b\u5173\u952e\u8bcd\u4e8c\n\\end{abstract}\n"
  files['main.tex']=preamble+start+'\n'+sections.join('\n')+'\n'+
    (thesis?"\\backmatter\n\\chapter*{\u81f4\u8c22}\n% \u5728\u6b64\u64b0\u5199\u81f4\u8c22\u3002\n":'')+"\\bibliographystyle{plain}\n\\bibliography{references}\n\\end{document}\n"
  return files
}

export function paperTemplateFiles(id:string):Record<string,string>{
  const template=getPaperTemplate(id)
  if(!template)throw new Error('未找到该论文模板。')
  const files=template.category==='chinese'?chineseFiles(template):englishFiles(template)
  files['references.bib']=bibliography
  files['README.md']=[
    '# '+template.name,
    '',
    'AToMAN 原创写作起始稿。主文件：main.tex。',
    '建议编译器：'+(template.compiler==='xelatex'?'XeLaTeX（需要 CTeX 和 Noto CJK 字体）':'pdfLaTeX')+'；参考文献使用 BibTeX。',
    '请替换示例内容和参考文献。章节文件位于 sections/；可将插图上传到 figures/。',
    ...(template.official?['','本模板不包含官方投稿样式，不应直接用于正式投稿。',template.official.guidance,'官方来源：'+template.official.url]:[]),
    ...(template.id==='chinese-thesis'?['','正式提交前必须改用所在学校及院系认可的学位论文模板。']:[]),
    '',
  ].join('\n')
  return files
}
