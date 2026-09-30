(()=>{var a={};a.id=8225,a.ids=[8225],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3421:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(71237),e=c(55088),f=c(17679);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},16698:a=>{"use strict";a.exports=require("node:async_hooks")},16979:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>y,POST:()=>z});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(50698),v=c(27143),w=c(40618),x=c(61615);async function y(){let{userId:a}=await (0,u.j)();if(!a)return new Response("Unauthorized",{status:401});if(!await (0,x.wV)(a))return new Response("Forbidden",{status:403});if(!(0,v.Z)())return Response.json({settings:{},auditLogs:[]});await (0,w.dC)();let b=await (0,x.Gx)(a),c=(0,v.f)(),d=Object.fromEntries((await c`
    SELECT setting_key, setting_value
    FROM site_settings
    ORDER BY setting_key ASC;
  `).map(a=>[a.setting_key,a.setting_value])),e=(0,x.Qx)(a);e||"string"!=typeof d.discord_webhook_url||(d.discord_webhook_url=d.discord_webhook_url.replace(/.(?=.{4,}$)/g,"•"));let f=await c`
    SELECT id, action, details, actor_user_id, actor_username, actor_has_discord_account, actor_has_login_account, actor_ip_address, actor_user_agent, metadata, severity, category, source, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 100;
  `,g={databaseConfigured:(0,v.Z)(),webhookConfigured:!!d.discord_webhook_url,auditLogEntries:f.length,latestActivityAt:f[0]?.created_at??null};return Response.json({settings:d,auditLogs:f,canEditWebhook:e,canEditPolicies:b.admin,health:g})}async function z(a){let{userId:b}=await (0,u.j)();if(!b)return new Response("Unauthorized",{status:401});if(!await (0,x.wV)(b))return new Response("Forbidden",{status:403});if(!(0,v.Z)())return new Response("Database not configured",{status:500});await (0,w.dC)();let c=await a.json().catch(()=>null),d=String(c?.action??"").trim(),e=String(c?.settingKey??"").trim(),f=String(c?.settingValue??"").trim(),g=(0,w.jS)(a);if(!e&&"revert"!==d)return new Response("Invalid setting",{status:400});if("discord_webhook_url"===e&&!(0,x.Qx)(b))return new Response("Only drevmourn can edit the Discord webhook URL.",{status:403});let h=(0,v.f)(),i=f;if("revert"===d){let a=await h`
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = ${e||"discord_webhook_url"}
      ORDER BY updated_at DESC
      LIMIT 1;
    `;if(0===a.length)return new Response("No previous value found",{status:404});i=a[0].setting_value}let j=await h`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = ${e||"discord_webhook_url"}
    LIMIT 1;
  `,k=j[0]?.setting_value??null;return await h`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (${e||"discord_webhook_url"}, ${i}, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();
  `,await (0,w.yI)({action:"revert"===d?"Settings reverted":"Settings updated",details:`${e||"discord_webhook_url"} ${"revert"===d?"reverted":"updated"}`,actorUserId:b,metadata:{settingKey:e||"discord_webhook_url",previousValue:k,newValue:i,reverted:"revert"===d},severity:"revert"===d?"warning":"info",category:"settings",source:"admin-settings",actorIpAddress:g.actorIpAddress,actorUserAgent:g.actorUserAgent}),Response.json({ok:!0})}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/admin/settings/route",pathname:"/api/admin/settings",filename:"route",bundlePath:"app/api/admin/settings/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\rodan\\Documents\\CVSD Assets\\cvsdgo\\app\\api\\admin\\settings\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/admin/settings/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27143:(a,b,c)=>{"use strict";c.d(b,{Z:()=>f,f:()=>g});var d=c(9608);let e=null;function f(){return!!process.env.DATABASE_URL}function g(){if(e)return e;let a=process.env.DATABASE_URL;if(!a)throw Error("DATABASE_URL environment variable is required for database operations.");return e=(0,d.lw)(a)}},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},40618:(a,b,c)=>{"use strict";c.d(b,{dC:()=>n,jS:()=>k,yI:()=>o});var d=c(59561),e=c(27143),f=c(61615);let g=new Map;"undefined"!=typeof setInterval&&setInterval(()=>{let a=Date.now()-6e4;for(let[b,c]of g){let d=c.filter(b=>b>a);0===d.length?g.delete(b):g.set(b,d)}},3e5);let h=null;async function i(a){if(!a)return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1};let b=(0,f.ed)(a);if(b)return{username:b.username,hasDiscordAccount:b.hasDiscordAccount,hasLoginAccount:b.hasLoginAccount};try{let b=await (0,d.$)(),c=await b.users.getUser(a),e=[c.firstName,c.lastName].filter(Boolean).join(" ").trim(),f=c.username||e||c.emailAddresses[0]?.emailAddress||null,g=c.externalAccounts.some(a=>a.provider.toLowerCase().includes("discord")),h=!!c.passwordEnabled||c.emailAddresses.length>0||c.externalAccounts.length>0;return{username:f,hasDiscordAccount:g,hasLoginAccount:h}}catch{return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1}}}function j(a){return"critical"===a?"critical":"warning"===a?"warning":"info"}function k(a){if(!a)return{actorIpAddress:null,actorUserAgent:null};let b=a.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??null,c=a.headers.get("x-real-ip")?.trim()??null;return{actorIpAddress:b??c,actorUserAgent:a.headers.get("user-agent")?.trim()??null}}async function l(){if(!(0,e.Z)())return null;let a=(0,e.f)(),b=await a`
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
    `,!d)return;let o=function(a,b){let c=a.action.toLowerCase(),d=b.toLowerCase();return"critical"===j(a.severity)||c.includes("delete")||c.includes("lock")||c.includes("ban")||c.includes("revoke")||c.includes("suspicious")||d.includes("mass")||d.includes("bulk")||d.includes("multiple")}(a,h);try{await fetch(d,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({allowed_mentions:{parse:[],users:[],roles:[]},embeds:[{title:`Audit: ${a.action}`,color:o?0xef4444:1920728,description:h,fields:[{name:"User",value:c||"Unknown user",inline:!0},{name:"Linked to Discord",value:a.actorHasDiscordAccount??b.hasDiscordAccount?"Yes":"No",inline:!0},{name:"Has login account",value:a.actorHasLoginAccount??b.hasLoginAccount?"Yes":"No",inline:!0},{name:"Severity",value:f,inline:!0},{name:"Action",value:a.action,inline:!1},{name:"Details",value:h,inline:!1}],timestamp:new Date().toISOString()}]})})}catch{}}catch{}}},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},61615:(a,b,c)=>{"use strict";c.d(b,{Gx:()=>o,Qx:()=>r,X2:()=>q,ed:()=>j,gP:()=>s,gs:()=>m,j2:()=>t,pF:()=>i,so:()=>n,wV:()=>p});var d=c(59561),e=c(50698);let f=["admin"],g=new Map;function h(a){let b=g.get(a);if(!b)return null;if(Date.now()>b.expiresAt)return g.delete(a),null;let{expiresAt:c,...d}=b;return d}function i(a){g.delete(a)}function j(a){return h(a)}function k(a){let b=function(a){let b=a.privateMetadata;return b&&"object"==typeof b?b:{}}(a).cvsdGo;return b&&"object"==typeof b?{admin:!0===b.admin,reportStaff:!0===b.reportStaff}:{}}function l(a){let b=k(a),c=a.externalAccounts.some(a=>"1012507248305647718"===a.providerUserId&&a.provider.toLowerCase().includes("discord")),d="string"==typeof a.username&&f.includes(a.username.toLowerCase()),e=c||d,g=e||!0===b.admin,h=g||!0===b.reportStaff;return{allowlisted:e,admin:g,reportStaff:h,canManageLinks:g,canManageReports:h}}function m(a){let b=k(a);return{admin:!0===b.admin,reportStaff:!0===b.reportStaff}}function n(a){return l(a)}async function o(a){var b;if(!a)return{allowlisted:!1,admin:!1,reportStaff:!1,canManageLinks:!1,canManageReports:!1};let c=h(a)?.profile??null;if(c)return c;let e=await (await (0,d.$)()).users.getUser(a),f=l(e),i=[e.firstName,e.lastName].filter(Boolean).join(" ").trim(),j=e.username||i||e.emailAddresses[0]?.emailAddress||null,k=e.externalAccounts.some(a=>a.provider.toLowerCase().includes("discord"));return b={profile:f,username:j,hasDiscordAccount:k,hasLoginAccount:!!e.passwordEnabled||e.emailAddresses.length>0||e.externalAccounts.length>0},g.set(a,{...b,expiresAt:Date.now()+3e4}),f}async function p(a){return(await o(a)).canManageLinks}async function q(a){return(await o(a)).admin}function r(a){return"user_3AhQ5Y8oIecKRmPgo7mEtNduoaW"===a}async function s(a){return(await o(a)).canManageReports}async function t(){let{userId:a}=await (0,e.j)();return a?await p(a)?null:new Response("Forbidden",{status:403}):new Response("Unauthorized",{status:401})}},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},73024:a=>{"use strict";a.exports=require("node:fs")},76760:a=>{"use strict";a.exports=require("node:path")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},95736:(a,b,c)=>{"use strict";a.exports=c(44870)},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[5745,925,1568],()=>b(b.s=16979));module.exports=c})();