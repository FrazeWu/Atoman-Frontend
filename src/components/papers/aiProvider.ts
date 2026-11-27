export const paperAIModelPattern=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const versionSegment=/^v[0-9]+(?:beta[0-9]*|alpha[0-9]*)?$/
const baseSyntax=/^https:\/\/[a-z0-9.-]+(?:\/[A-Za-z0-9_-]+)*$/
export function normalizePaperAIBase(raw:string){
 const trimmed=raw.trim()
 if(!trimmed||trimmed.length>512)return trimmed
 const value=(trimmed.includes('://')?trimmed:'https://'+trimmed).replace(/\/+$/,'')
 // Validate the original syntax before stripping known suffixes.
 if(value.length>512||!baseSyntax.test(value))return trimmed
 let url:URL
 try{url=new URL(value)}catch{return trimmed}
 if(url.origin!==value.split('/').slice(0,3).join('/'))return trimmed
 let path=url.pathname==='/'?'':url.pathname
 while(/\/(?:chat\/completions|models|responses)$/.test(path))path=path.replace(/\/(?:chat\/completions|models|responses)$/,'')
 const parts:string[]=[]
 for(const part of path.split('/')){
  if(parts[parts.length-1]===part&&versionSegment.test(part))continue
  parts.push(part)
 }
 return url.origin+parts.join('/')
}
export function validPaperAIBase(raw:string,custom:boolean,approved:string[]){
 const value=normalizePaperAIBase(raw)
 if(!custom)return approved.includes(value)
 if(value.length>512||!baseSyntax.test(value))return false
 try{
  const u=new URL(value)
  const host=u.hostname
  if(!host.includes('.')||/^\d+(?:\.\d+)*$/.test(host)||host.length>253||host.split('.').some(part=>!part||part.length>63||part.startsWith('-')||part.endsWith('-')))return false
  if(['localhost','local','internal','localdomain','lan','home.arpa','onion','invalid','test','atoman.org'].some(s=>host===s||host.endsWith('.'+s)))return false
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash
 }catch{return false}
}
// Independently verify that a resolved address returned by the server is one
// of our deterministic same-origin candidates, not arbitrary provider data.
export function paperAIModelBaseCandidates(raw:string,custom:boolean,approved:string[]){
 const base=normalizePaperAIBase(raw)
 if(!validPaperAIBase(base,custom,approved))return []
 const u=new URL(base),out=[base]
 const add=(value:string)=>{if(!out.includes(value)&&validPaperAIBase(value,custom,approved)&&new URL(value).origin===u.origin)out.push(value)}
 if(u.pathname==='/'){add(base+'/v1');return out}
 const parts=u.pathname.slice(1).split('/')
 for(let i=parts.length-1;i>=0;i--){
  if(!versionSegment.test(parts[i]!))continue
  const versionBase=u.origin+'/'+parts.slice(0,i+1).join('/')
  if(i<parts.length-1)add(versionBase)
  if(parts[i]==='v1')add(versionBase.slice(0,-3))
  return out
 }
 add(base+'/v1')
 return out
}
export function validPaperAIKey(value:string){
 return /^[!-~]{8,2048}$/.test(value)
}


// Only display local, fixed diagnostic messages, not third-party error text.
export function paperAIProviderDiagnostic(code:string,operation:'models'|'chat',status?:number){
 const messages:Record<string,string>={
  'papers.ai_models_wrong_path':'API 地址返回网页而不是模型列表，未找到兼容的模型接口。',
  'papers.ai_models_unsupported':'该服务不支持 GET /models，聊天接口仍可能正常。',
  'papers.ai_provider_auth':'第三方模型服务拒绝了认证，请检查该密钥是否具有相应接口权限。',
  'papers.ai_endpoint_denied':'API 地址或 DNS 解析结果不符合公开 HTTPS 安全限制。',
  'papers.ai_provider_timeout':'AToMAN 服务器连接模型服务超时；本机可用并不代表服务器也可用。',
  'papers.ai_provider_dns':'AToMAN 服务器无法解析该 API 域名。',
  'papers.ai_provider_tls':'模型服务的 HTTPS 证书验证失败。',
  'papers.ai_unavailable':'AToMAN 服务器无法连接该模型服务。',
  'papers.ai_provider_rate':'第三方模型服务限流或额度不足。',
  'papers.ai_provider_server':'第三方模型服务返回 5xx 服务端错误。',
  'papers.ai_provider_redirect':'模型服务返回重定向，请填写最终 HTTPS API 基础地址。',
  'papers.ai_provider_rejected':'模型服务拒绝了此接口请求，请检查地址和接口兼容性。',
  'papers.ai_invalid_models':'模型列表响应格式无法识别，或列表超出安全限制；聊天接口仍可能正常。',
  'papers.ai_busy':'当前 AI 请求容量已满，请稍后重试。',
  'papers.ai_disabled':'服务器未启用 AI 服务。',
  'papers.ai_invalid_input':'API 地址或密钥未通过服务器输入校验。',
 }
 const fallback=status===401?'AToMAN 登录会话失效，请重新登录。':status===404?'当前项目无法访问该接口，请检查项目权限或服务器版本。':status===502||status===503||status===504?'AToMAN 网关或模型服务暂时不可用。':'模型服务请求失败，请检查接口地址、密钥和网络。'
 return (messages[code]||fallback)+(operation==='models'?' 也可手动输入模型 ID。':' 原稿未修改。')
}


// This is deliberately an in-memory project connection, not a persisted profile.
export interface PaperAIConnection {
 accountId:string
 projectId:string
 baseURL:string
 key:string
 model:string
 models:string[]
}

const nonChatModel=/(?:embed(?:ding)?|rerank|image|whisper|(?:^|[-_/])tts(?:$|[-_/])|audio|speech|moderation|dall-e|(?:^|[-_/])(?:video|realtime)(?:$|[-_/]))/i
export function recommendedPaperAIModel(models:readonly string[],current=''){
 if(current&&models.includes(current))return current
 const candidates=models.filter(id=>!nonChatModel.test(id))
 const preferred=['gpt-4.1-mini','gpt-4o-mini','gpt-5-mini','deepseek-chat','qwen-plus','glm-4-flash','gemini-2.5-flash']
 for(const preferredID of preferred){
  const model=candidates.find(id=>id.toLowerCase()===preferredID||id.toLowerCase().endsWith('/'+preferredID))
  if(model)return model
 }
 // A suggested model is not proof that the account supports chat.
 const likely=candidates.find(id=>/(?:^|\/)(?:gpt-[345]|claude-|deepseek-(?:chat|reasoner)|qwen[0-9.-]*(?:-instruct|-plus|-turbo)|gemini-[0-9]|glm-[45]|(?:llama|mistral|mixtral)[-_])|(?:[-_/])(?:chat|instruct)(?:$|[-_/])/i.test(id))
 return likely||(candidates.length===1?candidates[0]:'')||''
}
