import type {PaperCompileDiagnostic,PaperCompileJob} from '@/api/papers'

export function compileStatusLabel(status:PaperCompileJob['status']|undefined):string{
 const labels:Record<string,string>={queued:'排队中',running:'编译中',recovering:'恢复中',succeeded:'已完成',failed:'编译失败',canceled:'已取消',blocked:'已阻断'}
 return labels[status||'']||'未知'
}
export function compileEngineLabel(engine:PaperCompileJob['compiler']):string{
 return engine==='xelatex'?'XeLaTeX':engine==='lualatex'?'LuaLaTeX':'pdfLaTeX'
}
export function compileFailureLabel(code:string):string{
 const labels:Record<string,string>={compile_failed:'LaTeX 源码编译错误',runtime_failed:'编译运行失败',isolation_failed:'编译环境初始化失败',artifact_missing:'未生成有效 PDF',timed_out:'编译超时',resource_exhausted_pids:'编译进程超过限制',resource_exhausted_memory:'编译内存超过限制',resource_exhausted_ambiguous:'编译资源超过限制',verified_pdf_not_persisted:'PDF 保存失败',cleanup_failed:'编译环境回收异常',owner_canceled:'任务已取消',cancel_requested:'任务已取消',access_revoked:'项目访问权限已撤销'}
 return labels[code]||'编译未成功'
}
// Static, local suggestions. Never interpret log text as instructions or
// execute commands; messages are untrusted excerpts, not a diagnosis.
export function compileDiagnosticHint(row:PaperCompileDiagnostic):string{
 const m=row.message.toLowerCase()
 if(/undefined control sequence/.test(m))return '检查命令拼写、所需宏包是否已加载，以及自定义命令是否已定义。'
 if(/file .*not found|i couldn't open|cannot find/.test(m))return '检查项目文件是否完整、文件名大小写和相对路径，以及所需宏包是否可用。'
 if(/runaway argument|file ended while scanning|missing \}|extra \}/.test(m))return '检查附近的花括号是否配对，尤其是命令参数和上一段的内容。'
 if(/missing \$ inserted|bad math environment delimiter|display math should end/.test(m))return '检查数学模式的开始与结束标记是否配对。'
 if(/unicode character|fontspec|requires.*(xetex|luatex)/.test(m))return '检查 Unicode 字符及字体设置；含中文或 fontspec 的项目通常适合 XeLaTeX 或 LuaLaTeX。'
 if(/option clash for package/.test(m))return '检查同一宏包是否以不同选项重复加载。'
 if(/\bundefined references?\b|\bcitation\b.*undefined|i found no \\citation/.test(m))return '检查引用键是否存在、参考文献文件是否正确引用，以及文献编译流程。'
 if(/illegal, another|bibtex syntax|i found no|too many/.test(m)&&row.tool==='bibtex')return '检查 BibTeX 条目的分隔符、引号、括号和必需字段。'
 if(/ended by|environment .*undefined/.test(m))return '检查环境名称及开始、结束命令是否匹配。'
 return ''
}
export function compileFailureHint(code:string|undefined):string{
 if(!code)return ''
 if(code==='compile_failed')return '优先修复第一条源码错误，再重新编译；后续错误可能由它引起。'
 if(code==='timed_out'||code.startsWith('resource_exhausted_'))return '检查循环展开、超大图片或复杂绘图；可尝试简化输入后重新编译。'
 if(code==='owner_canceled'||code==='cancel_requested')return '本次任务已取消，可以重新发起编译。'
 if(code==='access_revoked')return '项目访问权限已变化，请重新检查权限。'
 return '如重复编译仍失败，请复制错误摘要并联系维护人员；不会显示宿主机运行日志。'
}
export function compileDuration(job:PaperCompileJob):string{
 const start=Date.parse(job.started_at||''),end=Date.parse(job.finished_at||'')
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return '—'
 const seconds=Math.floor((end-start)/1000)
 return seconds<60?seconds+' 秒':Math.floor(seconds/60)+' 分 '+seconds%60+' 秒'
}
export function compileReport(job:PaperCompileJob):string{
 const rows=['编译状态：'+compileStatusLabel(job.status),'编译器：'+compileEngineLabel(job.compiler),'源码版本：'+job.source_revision,'编译耗时：'+compileDuration(job)]
 if(job.failure_code)rows.push('错误代码：'+job.failure_code)
 for(const item of (job.diagnostics||[]).slice(0,12)){
  rows.push((item.tool==='bibtex'?'BibTeX':'LaTeX')+(item.file&&item.line?' · '+item.file+':'+item.line:'')+' — '+item.message)
 }
 return rows.join('\n')
}
