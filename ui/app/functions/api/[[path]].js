export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  if (url.pathname.startsWith("/api")) {
    url.hostname = "api.az7.chat";
    
    url.pathname = url.pathname.replace(/^\/api/, "");

  } else if (url.pathname.startsWith("/gateway")) {
    url.hostname = "gateway.az7.chat";
  
    url.pathname = url.pathname.replace(/^\/gateway/, "");

  }

  const newRequest = new Request(url.toString(), context.request);
  
  return fetch(newRequest);
}