// Prueba de redes sociales personales y de clientes: node test/social.mjs
const B='http://localhost:4000/api'; let t,biz;
const ok=(c,m)=>console.log(c?'✓':'✗',m);
const j=async(m,p,b)=>{const r=await fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t&&{authorization:'Bearer '+t}),...(biz&&{'x-business-id':biz})},body:b&&JSON.stringify(b)});return{s:r.status,d:await r.json()}};
let r=await j('POST','/auth/login',{email:'demo@dream.co',password:'Dream2026'}); t=r.d.accessToken;
r=await j('GET','/auth/me'); biz=r.d.businesses[0].businessId; ok(r.d.user.socialLinks.instagram==='@valen.rios','perfil demo trae redes personales');
r=await j('PATCH','/auth/me',{socialLinks:{instagram:'@nueva',tiktok:'@yo',linkedin:''}}); ok(r.s===200&&r.d.socialLinks.tiktok==='@yo'&&!('linkedin' in r.d.socialLinks),'actualizar redes personales');
r=await j('PATCH','/auth/me',{socialLinks:{instagram:'javascript:alert(1)'}}); ok(r.s===400,'bloquea enlace peligroso: '+r.d.message);
r=await j('PATCH','/auth/me',{socialLinks:{myspace:'x'}}); ok(r.s===400,'bloquea red desconocida');
r=await j('POST','/customers',{name:'Cliente Redes',socialLinks:{instagram:'@cliente.redes',whatsapp:'+57 311 111 1111'}}); ok(r.s===201&&r.d.socialLinks.instagram==='@cliente.redes','crear cliente con redes');
const id=r.d.id;
r=await j('GET','/customers?q=cliente.redes'); ok(r.d.items.some(c=>c.id===id),'buscar cliente por @usuario');
r=await j('PATCH','/customers/'+id,{socialLinks:{tiktok:'@tk'}}); ok(r.d.socialLinks.tiktok==='@tk'&&!r.d.socialLinks.instagram,'editar redes del cliente');
r=await j('GET','/businesses/current/members'); ok(r.d[0].socialLinks!==undefined,'equipo muestra redes personales');
