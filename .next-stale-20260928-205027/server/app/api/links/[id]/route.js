"use strict";(()=>{var a={};a.id=9645,a.ids=[9645],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},13886:(a,b,c)=>{c.d(b,{T:()=>d});function d(a){return a.replace(/^go\//i,"").trim().toLowerCase()}},16698:a=>{a.exports=require("node:async_hooks")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},35808:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>M,patchFetch:()=>L,routeModule:()=>H,serverHooks:()=>K,workAsyncStorage:()=>I,workUnitAsyncStorage:()=>J});var d={};c.r(d),c.d(d,{DELETE:()=>G,PUT:()=>F});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(16780),v=c(50698),w=c(27143),x=c(13886),y=c(29416),z=c(61615),A=c(76009),B=c(40618),C=c(73148);function D(a){if(null==a||""===a)return null;let b=new Date(String(a));return Number.isNaN(b.getTime())?null:b}async function E(a,b){return null===b||(await a`
    SELECT id
    FROM link_folders
    WHERE id = ${b}
    LIMIT 1;
  `).length>0}async function F(a,{params:b}){let c=await (0,z.j2)();if(c)return c;if(!(0,w.Z)())return new Response("Database not configured",{status:500});await (0,A.e)();let{id:d}=await b,e=await a.json().catch(()=>null);if(!e||"object"!=typeof e)return new Response("Invalid request",{status:400});let f=(0,B.jS)(a),g=(0,x.T)(String(e.slug??"")),h=String(e.description??"").trim()||null,i=!!e.isLocked,j=String(e.password??"").trim(),k=function(a){try{return new URL(a).toString()}catch{return null}}(String(e.url??"")),l=D(e.releaseAt),m=D(e.expiresAt),n=function(a){if(null==a||""===a)return null;let b=Number(a);return!Number.isInteger(b)||b<=0?null:b}(e.folderId),o=!!e.qrCodeAccessEnabled;if(!g||!k)return new Response("Invalid input",{status:400});let p=await (0,C.Xl)(`${g} ${h??""} ${k}`);if(!p.isClean)return new Response(p.reason||"Content blocked by AutoMod",{status:400});if(null!==e.folderId&&void 0!==e.folderId&&null===n)return new Response("Folder is invalid",{status:400});if(i&&j&&j.length<4)return new Response("Password must be at least 4 characters",{status:400});if(e.releaseAt&&!l)return new Response("Release time is invalid",{status:400});if(e.expiresAt&&!m)return new Response("Expiration time is invalid",{status:400});if(l&&m&&l>=m)return new Response("Release time must be before expiration time",{status:400});let q=(0,w.f)();if(!await E(q,n))return new Response("Folder not found",{status:404});try{if(!i){let a=await q`
        UPDATE redirects
        SET slug = ${g}, url = ${k}, description = ${h}, folder_id = ${n}, is_locked = false, password_hash = NULL, release_at = ${l}, expires_at = ${m}, qr_code_access_enabled = ${o}, updated_at = NOW()
        WHERE id = ${d}
        RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id, qr_code_access_enabled;
      `;if(0===a.length)return new Response("Not found",{status:404});return(0,u.revalidateTag)("redirects"),Response.json({link:a[0]})}if(j){let a=(0,y.E)(j),b=await q`
        UPDATE redirects
        SET slug = ${g}, url = ${k}, description = ${h}, folder_id = ${n}, is_locked = true, password_hash = ${a}, release_at = ${l}, expires_at = ${m}, qr_code_access_enabled = ${o}, updated_at = NOW()
        WHERE id = ${d}
        RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id, qr_code_access_enabled;
      `;if(0===b.length)return new Response("Not found",{status:404});return await (0,B.yI)({action:"Link updated",details:`${g} → ${k}${i?" (locked)":""}`,actorUserId:(await (0,v.j)()).userId??null,category:"links",source:"link-manager",actorIpAddress:f.actorIpAddress,actorUserAgent:f.actorUserAgent}),(0,u.revalidateTag)("redirects"),Response.json({link:b[0]})}let a=await q`
      SELECT password_hash
      FROM redirects
      WHERE id = ${d};
    `;if(0===a.length)return new Response("Not found",{status:404});if(!a[0].password_hash)return new Response("Password required to lock this link",{status:400});let b=await q`
      UPDATE redirects
      SET slug = ${g}, url = ${k}, description = ${h}, folder_id = ${n}, is_locked = true, release_at = ${l}, expires_at = ${m}, qr_code_access_enabled = ${o}, updated_at = NOW()
      WHERE id = ${d}
      RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id, qr_code_access_enabled;
    `;if(0===b.length)return new Response("Not found",{status:404});return await (0,B.yI)({action:"Link updated",details:`${g} → ${k}${i?" (locked)":""}`,actorUserId:(await (0,v.j)()).userId??null,category:"links",source:"link-manager",actorIpAddress:f.actorIpAddress,actorUserAgent:f.actorUserAgent}),(0,u.revalidateTag)("redirects"),Response.json({link:b[0]})}catch(a){if((a.message??"").toLowerCase().includes("unique"))return new Response("Slug already exists",{status:409});throw a}}async function G(a,{params:b}){let c=await (0,z.j2)();if(c)return c;if(!(0,w.Z)())return new Response("Database not configured",{status:500});await (0,A.e)();let{id:d}=await b,e=(0,w.f)();if(0===(await e`
    DELETE FROM redirects
    WHERE id = ${d}
    RETURNING id;
  `).length)return new Response("Not found",{status:404});let f=(0,B.jS)(a);return await (0,B.yI)({action:"Link deleted",details:`Link ${d} removed`,actorUserId:(await (0,v.j)()).userId??null,severity:"warning",category:"links",source:"link-manager",actorIpAddress:f.actorIpAddress,actorUserAgent:f.actorUserAgent}),(0,u.revalidateTag)("redirects"),Response.json({ok:!0})}let H=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/links/[id]/route",pathname:"/api/links/[id]",filename:"route",bundlePath:"app/api/links/[id]/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\rodan\\Documents\\CVSD Assets\\cvsdgo\\app\\api\\links\\[id]\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:I,workUnitAsyncStorage:J,serverHooks:K}=H;function L(){return(0,g.patchFetch)({workAsyncStorage:I,workUnitAsyncStorage:J})}async function M(a,b,c){var d;let e="/api/links/[id]/route";"/index"===e&&(e="/");let g=await H.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,D=(0,j.normalizeAppPath)(e),E=!!(y.dynamicRoutes[D]||y.routes[C]);if(E&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[D];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let F=null;!E||H.isDev||x||(F="/index"===(F=C)?"/":F);let G=!0===H.isDev||!E,I=E&&!G,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:G,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>H.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>H.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!E)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await H.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await H.handleResponse({req:a,nextConfig:w,cacheKey:F,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!E)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&E||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await H.onRequestError(a,b,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),E)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},40618:(a,b,c)=>{c.d(b,{dC:()=>n,jS:()=>k,yI:()=>o});var d=c(59561),e=c(27143),f=c(61615);let g=new Map;"undefined"!=typeof setInterval&&setInterval(()=>{let a=Date.now()-6e4;for(let[b,c]of g){let d=c.filter(b=>b>a);0===d.length?g.delete(b):g.set(b,d)}},3e5);let h=null;async function i(a){if(!a)return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1};let b=(0,f.ed)(a);if(b)return{username:b.username,hasDiscordAccount:b.hasDiscordAccount,hasLoginAccount:b.hasLoginAccount};try{let b=await (0,d.$)(),c=await b.users.getUser(a),e=[c.firstName,c.lastName].filter(Boolean).join(" ").trim(),f=c.username||e||c.emailAddresses[0]?.emailAddress||null,g=c.externalAccounts.some(a=>a.provider.toLowerCase().includes("discord")),h=!!c.passwordEnabled||c.emailAddresses.length>0||c.externalAccounts.length>0;return{username:f,hasDiscordAccount:g,hasLoginAccount:h}}catch{return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1}}}function j(a){return"critical"===a?"critical":"warning"===a?"warning":"info"}function k(a){if(!a)return{actorIpAddress:null,actorUserAgent:null};let b=a.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??null,c=a.headers.get("x-real-ip")?.trim()??null;return{actorIpAddress:b??c,actorUserAgent:a.headers.get("user-agent")?.trim()??null}}async function l(){if(!(0,e.Z)())return null;let a=(0,e.f)(),b=await a`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = 'discord_webhook_url';
  `;return b[0]?.setting_value??null}async function m(){if(!(0,e.Z)())return;let a=(0,e.f)();try{if((await a`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' LIMIT 1;
    `).length>0)return}catch{}await a`
    CREATE TABLE IF NOT EXISTS site_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,await a`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      actor_user_id TEXT,
      actor_username TEXT,
      actor_has_discord_account BOOLEAN NOT NULL DEFAULT FALSE,
      actor_has_login_account BOOLEAN NOT NULL DEFAULT FALSE,
      actor_ip_address TEXT,
      actor_user_agent TEXT,
      metadata JSONB,
      severity TEXT NOT NULL DEFAULT 'info',
      category TEXT,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,await a`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
  `,await a`
    CREATE INDEX IF NOT EXISTS audit_logs_severity_idx ON audit_logs(severity);
  `}async function n(){h||(h=m().catch(a=>{throw h=null,a})),await h}async function o(a){if((0,e.Z)())try{await n();let b=await i(a.actorUserId),c=a.actorUsername??b.username,d=await l(),f=function(a){if("critical"===a.severity)return"critical";let b=`${a.actorUserId??"anonymous"}:${a.action.toLowerCase()}`,c=Date.now(),d=(g.get(b)??[]).filter(a=>c-a<6e4);return(d.push(c),g.set(b,d),d.length>=3)?"critical":j(a.severity)}(a),h=a.details??"No additional details were provided.",k=a.metadata?JSON.stringify(a.metadata):null,m=(0,e.f)();if(await m`
      INSERT INTO audit_logs (
        action,
        details,
        actor_user_id,
        actor_username,
        actor_has_discord_account,
        actor_has_login_account,
        actor_ip_address,
        actor_user_agent,
        metadata,
        severity,
        category,
        source
      )
      VALUES (
        ${a.action},
        ${h},
        ${a.actorUserId??null},
        ${c??null},
        ${a.actorHasDiscordAccount??b.hasDiscordAccount},
        ${a.actorHasLoginAccount??b.hasLoginAccount},
        ${a.actorIpAddress??null},
        ${a.actorUserAgent??null},
        ${k}::jsonb,
        ${f},
        ${a.category??null},
        ${a.source??null}
      );
    `,!d)return;let o=function(a,b){let c=a.action.toLowerCase(),d=b.toLowerCase();return"critical"===j(a.severity)||c.includes("delete")||c.includes("lock")||c.includes("ban")||c.includes("revoke")||c.includes("suspicious")||d.includes("mass")||d.includes("bulk")||d.includes("multiple")}(a,h);try{await fetch(d,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({allowed_mentions:{parse:[],users:[],roles:[]},embeds:[{title:`Audit: ${a.action}`,color:o?0xef4444:1920728,description:h,fields:[{name:"User",value:c||"Unknown user",inline:!0},{name:"Linked to Discord",value:a.actorHasDiscordAccount??b.hasDiscordAccount?"Yes":"No",inline:!0},{name:"Has login account",value:a.actorHasLoginAccount??b.hasLoginAccount?"Yes":"No",inline:!0},{name:"Severity",value:f,inline:!0},{name:"Action",value:a.action,inline:!1},{name:"Details",value:h,inline:!1}],timestamp:new Date().toISOString()}]})})}catch{}}catch{}}},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},73024:a=>{a.exports=require("node:fs")},73148:(a,b,c)=>{c.d(b,{Xl:()=>k});var d=c(27143);let e=["fuck","shit","bitch","cunt","asshole","bastard","dick","pussy","cock","whore","slut","nigger","nigga","faggot","retard","motherfucker","bullshit","damn","crap"],f={"@":"a",4:"a",8:"b",3:"e",1:"i","!":"i",0:"o",$:"s",5:"s",7:"t","+":"t"},g=["class","classes","classify","classification","pass","passenger","password","compass","asset","assets","assessment","assess","associate","association","glass","grass","mass","enroll","calendar","scunthorpe","document","documentation","analytic","analytics","analysis"],h=null,i=0;async function j(){if(!(0,d.Z)())return[];let a=Date.now();if(h&&a-i<6e4)return h;try{let b=(0,d.f)(),c=await b`
      SELECT setting_value FROM site_settings WHERE setting_key = 'automod_blocked_terms' LIMIT 1;
    `;if(c[0]?.setting_value){let b=c[0].setting_value.split(",").map(a=>a.trim().toLowerCase()).filter(Boolean);return h=b,i=a,b}}catch{}return h=[],i=a,[]}async function k(a){if(!a||"string"!=typeof a)return{isClean:!0};let b=a.toLowerCase(),c=function(a){let b=a.toLowerCase();for(let[a,c]of Object.entries(f))b=b.replaceAll(a,c);return b}(a),d=await j(),h=Array.from(new Set([...e,...d])),i=c.split(/[^a-z0-9]+/i).filter(Boolean),k=b.split(/[^a-z0-9]+/i).filter(Boolean);for(let a of i)if(!g.includes(a)){for(let b of h)if(a===b||b.length>=4&&a.includes(b)&&!g.some(b=>b.includes(a)||a.includes(b)))return{isClean:!1,blockedTerm:b,reason:`Content contains inappropriate or profane language blocked by AutoMod ("${b}").`}}for(let a of k)if(!g.includes(a)){for(let b of d)if(a===b)return{isClean:!1,blockedTerm:b,reason:`Content contains inappropriate or profane language blocked by AutoMod ("${b}").`}}return{isClean:!0}}},76760:a=>{a.exports=require("node:path")},77598:a=>{a.exports=require("node:crypto")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[5745,925,1568,6780,4298],()=>b(b.s=35808));module.exports=c})();