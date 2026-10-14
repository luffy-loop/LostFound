import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-webhook-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 if(req.method!=="POST") return new Response("Method not allowed",{status:405,headers});
 const secret=Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
 if(!secret || req.headers.get("x-webhook-secret")!==secret) return new Response("Unauthorized",{status:401,headers});
 try {
  const {notification_id}=await req.json();
  if(typeof notification_id!=="string" || !notification_id) return new Response("notification_id is required",{status:400,headers});
  const url=Deno.env.get("SUPABASE_URL"), serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), resendKey=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("NOTIFICATION_FROM_EMAIL");
  if(!url || !serviceKey || !resendKey || !from) return new Response("Notification service is not configured",{status:503,headers});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:n,error:ne}=await admin.from("notifications").select("id,user_id,title,body,email_sent_at").eq("id",notification_id).maybeSingle();
  if(ne) throw ne;
  if(!n) return new Response("Notification not found",{status:404,headers});
  if(n.email_sent_at) return new Response("Already sent",{status:200,headers});
  const {data:u,error:ue}=await admin.auth.admin.getUserById(n.user_id);
  if(ue) throw ue;
  if(!u.user?.email) return new Response("Recipient has no email",{status:422,headers});
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+resendKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[u.user.email],subject:"LostFound: "+n.title,text:n.body+"\n\nOpen LostFound to view the update."})});
  if(!response.ok) throw new Error("Email provider returned "+response.status);
  const {error:ue2}=await admin.from("notifications").update({email_sent_at:new Date().toISOString()}).eq("id",notification_id);
  if(ue2) throw ue2;
  return new Response(JSON.stringify({sent:true}),{status:200,headers:{...headers,"Content-Type":"application/json"}});
 } catch(error) {
  console.error("notification delivery failed",error);
  return new Response("Notification delivery failed",{status:500,headers});
 }
});
