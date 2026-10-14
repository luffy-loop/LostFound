import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
let clientPromise;
export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export async function getBackend() {
 if (!isBackendConfigured) throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.");
 if (!clientPromise) clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({createClient}) => createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
 return clientPromise;
}
export async function uploadItemImage(file,userId) {
 if (!file || !userId) throw new Error("A file and signed-in user are required.");
 if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size>2097152) throw new Error("Choose a JPEG, PNG, WebP, or GIF image no larger than 2 MB.");
 const client=await getBackend(), extension=file.type.split("/")[1].replace("jpeg","jpg"), path=userId+"/"+crypto.randomUUID()+"."+extension;
 const {error}=await client.storage.from("item-images").upload(path,file,{contentType:file.type,upsert:false});
 if(error) throw error;
 return {path,publicUrl:client.storage.from("item-images").getPublicUrl(path).data.publicUrl};
}
export async function signIn(email,password) { const {data,error}=await (await getBackend()).auth.signInWithPassword({email,password}); if(error) throw error; return data; }
export async function signUp(email,password,metadata={}) {
 if(String(password||"").length<10) throw new Error("Use a password with at least 10 characters.");
 const {data,error}=await (await getBackend()).auth.signUp({email,password,options:{data:metadata}});
 if(error) throw error; return data;
}
export async function signOut() { const {error}=await (await getBackend()).auth.signOut(); if(error) throw error; }
export async function listActiveItems() {
 const {data,error}=await (await getBackend()).from("items").select("*").is("archived_at",null).order("created_at",{ascending:false});
 if(error) throw error; return data;
}
export async function createItem(input,ownerId) {
 const {data,error}=await (await getBackend()).from("items").insert({owner_id:ownerId,item_name:input.itemName,description:input.description,category:input.category,report_type:input.type,location:input.location,occurred_at:input.occurredAt||null,urgent:Boolean(input.urgent),image_path:input.imagePath||null}).select().single();
 if(error) throw error; return data;
}
export async function submitItemClaim(itemId,claimantId,privateProof) {
 const {data,error}=await (await getBackend()).from("claims").insert({item_id:itemId,claimant_id:claimantId,private_proof:String(privateProof||"").trim()}).select().single();
 if(error) throw error; return data;
}
export async function sendItemMessage(itemId,senderId,recipientId,body) {
 const {data,error}=await (await getBackend()).from("messages").insert({item_id:itemId,sender_id:senderId,recipient_id:recipientId,body:String(body||"").trim()}).select().single();
 if(error) throw error; return data;
}
