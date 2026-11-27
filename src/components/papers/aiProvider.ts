export const paperAIModelPattern=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
export function normalizePaperAIBase(raw:string){
 return raw.trim().replace(/\/$/,'').replace(/\/(?:chat\/completions|models)$/,'')
}
export function validPaperAIBase(raw:string,custom:boolean,approved:string[]){
 const value=normalizePaperAIBase(raw)
 if(!custom)return approved.includes(value)
 if(value.length>512||!/^https:\/\/[a-z0-9.-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value))return false
 try{
  const u=new URL(value)
  const host=u.hostname
  if(!host.includes('.')||/^\d+(?:\.\d+)*$/.test(host)||host.length>253||host.split('.').some(part=>!part||part.length>63||part.startsWith('-')||part.endsWith('-')))return false
  if(['localhost','local','internal','localdomain','lan','home.arpa','onion','invalid','test','atoman.org'].some(s=>host===s||host.endsWith('.'+s)))return false
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash
 }catch{return false}
}
export function validPaperAIKey(value:string){
 return /^[!-~]{8,2048}$/.test(value)
}


// Only display local, fixed diagnostic messages, not third-party error text.
export function paperAIProviderDiagnostic(code:string,operation:'models'|'chat',status?:number){
 const messages:Record<string,string>={
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
