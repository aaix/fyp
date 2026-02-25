export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  const targetHost = "gateway.az7.chat"; 
  url.hostname = targetHost;
  
  url.pathname = url.pathname.replace(/^\/gateway/, "");

  const newRequest = new Request(url.toString(), context.request);
  
  return fetch(newRequest);
}