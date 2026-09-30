(()=>{var a={};a.id=647,a.ids=[647],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3421:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(71237),e=c(55088),f=c(17679);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},16698:a=>{"use strict";a.exports=require("node:async_hooks")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21947:(a,b,c)=>{"use strict";c.d(b,{k:()=>g});var d=c(27143);let e=null;async function f(){if(!(0,d.Z)())return;let a=(0,d.f)();await a`
    CREATE TABLE IF NOT EXISTS reporting_profiles (
      user_id TEXT PRIMARY KEY,
      report_ban_type TEXT NOT NULL DEFAULT 'none',
      banned_until TIMESTAMPTZ,
      limit_hourly INTEGER NOT NULL DEFAULT 0,
      limit_daily INTEGER NOT NULL DEFAULT 0,
      strikes INTEGER NOT NULL DEFAULT 0,
      last_strike_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,await a`
    ALTER TABLE IF EXISTS reports
    ADD COLUMN IF NOT EXISTS handled_by_user_id TEXT;
  `,await a`
    ALTER TABLE IF EXISTS reports
    ADD COLUMN IF NOT EXISTS handled_by_name TEXT;
  `,await a`
    CREATE TABLE IF NOT EXISTS report_strikes (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      report_id BIGINT REFERENCES reports(id) ON DELETE SET NULL,
      reason TEXT,
      strike_type TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,await a`
    CREATE INDEX IF NOT EXISTS reporting_profiles_user_id_idx ON reporting_profiles(user_id);
  `,await a`
    CREATE INDEX IF NOT EXISTS report_strikes_user_id_idx ON report_strikes(user_id);
  `}async function g(){e||(e=f().catch(a=>{throw e=null,a})),await e}},27143:(a,b,c)=>{"use strict";c.d(b,{Z:()=>f,f:()=>g});var d=c(9608);let e=null;function f(){return!!process.env.DATABASE_URL}function g(){if(e)return e;let a=process.env.DATABASE_URL;if(!a)throw Error("DATABASE_URL environment variable is required for database operations.");return e=(0,d.lw)(a)}},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},40618:(a,b,c)=>{"use strict";c.d(b,{dC:()=>n,jS:()=>k,yI:()=>o});var d=c(59561),e=c(27143),f=c(61615);let g=new Map;"undefined"!=typeof setInterval&&setInterval(()=>{let a=Date.now()-6e4;for(let[b,c]of g){let d=c.filter(b=>b>a);0===d.length?g.delete(b):g.set(b,d)}},3e5);let h=null;async function i(a){if(!a)return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1};let b=(0,f.ed)(a);if(b)return{username:b.username,hasDiscordAccount:b.hasDiscordAccount,hasLoginAccount:b.hasLoginAccount};try{let b=await (0,d.$)(),c=await b.users.getUser(a),e=[c.firstName,c.lastName].filter(Boolean).join(" ").trim(),f=c.username||e||c.emailAddresses[0]?.emailAddress||null,g=c.externalAccounts.some(a=>a.provider.toLowerCase().includes("discord")),h=!!c.passwordEnabled||c.emailAddresses.length>0||c.externalAccounts.length>0;return{username:f,hasDiscordAccount:g,hasLoginAccount:h}}catch{return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1}}}function j(a){return"critical"===a?"critical":"warning"===a?"warning":"info"}function k(a){if(!a)return{actorIpAddress:null,actorUserAgent:null};let b=a.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??null,c=a.headers.get("x-real-ip")?.trim()??null;return{actorIpAddress:b??c,actorUserAgent:a.headers.get("user-agent")?.trim()??null}}async function l(){if(!(0,e.Z)())return null;let a=(0,e.f)(),b=await a`
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
    `,!d)return;let o=function(a,b){let c=a.action.toLowerCase(),d=b.toLowerCase();return"critical"===j(a.severity)||c.includes("delete")||c.includes("lock")||c.includes("ban")||c.includes("revoke")||c.includes("suspicious")||d.includes("mass")||d.includes("bulk")||d.includes("multiple")}(a,h);try{await fetch(d,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({allowed_mentions:{parse:[],users:[],roles:[]},embeds:[{title:`Audit: ${a.action}`,color:o?0xef4444:1920728,description:h,fields:[{name:"User",value:c||"Unknown user",inline:!0},{name:"Linked to Discord",value:a.actorHasDiscordAccount??b.hasDiscordAccount?"Yes":"No",inline:!0},{name:"Has login account",value:a.actorHasLoginAccount??b.hasLoginAccount?"Yes":"No",inline:!0},{name:"Severity",value:f,inline:!0},{name:"Action",value:a.action,inline:!1},{name:"Details",value:h,inline:!1}],timestamp:new Date().toISOString()}]})})}catch{}}catch{}}},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},61615:(a,b,c)=>{"use strict";c.d(b,{Gx:()=>o,Qx:()=>r,X2:()=>q,ed:()=>j,gP:()=>s,gs:()=>m,j2:()=>t,pF:()=>i,so:()=>n,wV:()=>p});var d=c(59561),e=c(50698);let f=["admin"],g=new Map;function h(a){let b=g.get(a);if(!b)return null;if(Date.now()>b.expiresAt)return g.delete(a),null;let{expiresAt:c,...d}=b;return d}function i(a){g.delete(a)}function j(a){return h(a)}function k(a){let b=function(a){let b=a.privateMetadata;return b&&"object"==typeof b?b:{}}(a).cvsdGo;return b&&"object"==typeof b?{admin:!0===b.admin,reportStaff:!0===b.reportStaff}:{}}function l(a){let b=k(a),c=a.externalAccounts.some(a=>"1012507248305647718"===a.providerUserId&&a.provider.toLowerCase().includes("discord")),d="string"==typeof a.username&&f.includes(a.username.toLowerCase()),e=c||d,g=e||!0===b.admin,h=g||!0===b.reportStaff;return{allowlisted:e,admin:g,reportStaff:h,canManageLinks:g,canManageReports:h}}function m(a){let b=k(a);return{admin:!0===b.admin,reportStaff:!0===b.reportStaff}}function n(a){return l(a)}async function o(a){var b;if(!a)return{allowlisted:!1,admin:!1,reportStaff:!1,canManageLinks:!1,canManageReports:!1};let c=h(a)?.profile??null;if(c)return c;let e=await (await (0,d.$)()).users.getUser(a),f=l(e),i=[e.firstName,e.lastName].filter(Boolean).join(" ").trim(),j=e.username||i||e.emailAddresses[0]?.emailAddress||null,k=e.externalAccounts.some(a=>a.provider.toLowerCase().includes("discord"));return b={profile:f,username:j,hasDiscordAccount:k,hasLoginAccount:!!e.passwordEnabled||e.emailAddresses.length>0||e.externalAccounts.length>0},g.set(a,{...b,expiresAt:Date.now()+3e4}),f}async function p(a){return(await o(a)).canManageLinks}async function q(a){return(await o(a)).admin}function r(a){return"user_3AhQ5Y8oIecKRmPgo7mEtNduoaW"===a}async function s(a){return(await o(a)).canManageReports}async function t(){let{userId:a}=await (0,e.j)();return a?await p(a)?null:new Response("Forbidden",{status:403}):new Response("Unauthorized",{status:401})}},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},73024:a=>{"use strict";a.exports=require("node:fs")},73148:(a,b,c)=>{"use strict";c.d(b,{Xl:()=>k});var d=c(27143);let e=["fuck","shit","bitch","cunt","asshole","bastard","dick","pussy","cock","whore","slut","nigger","nigga","faggot","retard","motherfucker","bullshit","damn","crap"],f={"@":"a",4:"a",8:"b",3:"e",1:"i","!":"i",0:"o",$:"s",5:"s",7:"t","+":"t"},g=["class","classes","classify","classification","pass","passenger","password","compass","asset","assets","assessment","assess","associate","association","glass","grass","mass","enroll","calendar","scunthorpe","document","documentation","analytic","analytics","analysis"],h=null,i=0;async function j(){if(!(0,d.Z)())return[];let a=Date.now();if(h&&a-i<6e4)return h;try{let b=(0,d.f)(),c=await b`
      SELECT setting_value FROM site_settings WHERE setting_key = 'automod_blocked_terms' LIMIT 1;
    `;if(c[0]?.setting_value){let b=c[0].setting_value.split(",").map(a=>a.trim().toLowerCase()).filter(Boolean);return h=b,i=a,b}}catch{}return h=[],i=a,[]}async function k(a){if(!a||"string"!=typeof a)return{isClean:!0};let b=a.toLowerCase(),c=function(a){let b=a.toLowerCase();for(let[a,c]of Object.entries(f))b=b.replaceAll(a,c);return b}(a),d=await j(),h=Array.from(new Set([...e,...d])),i=c.split(/[^a-z0-9]+/i).filter(Boolean),k=b.split(/[^a-z0-9]+/i).filter(Boolean);for(let a of i)if(!g.includes(a)){for(let b of h)if(a===b||b.length>=4&&a.includes(b)&&!g.some(b=>b.includes(a)||a.includes(b)))return{isClean:!1,blockedTerm:b,reason:`Content contains inappropriate or profane language blocked by AutoMod ("${b}").`}}for(let a of k)if(!g.includes(a)){for(let b of d)if(a===b)return{isClean:!1,blockedTerm:b,reason:`Content contains inappropriate or profane language blocked by AutoMod ("${b}").`}}return{isClean:!0}}},76760:a=>{"use strict";a.exports=require("node:path")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},91305:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>I,patchFetch:()=>H,routeModule:()=>D,serverHooks:()=>G,workAsyncStorage:()=>E,workUnitAsyncStorage:()=>F});var d={};c.r(d),c.d(d,{GET:()=>B,POST:()=>C});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(50698),v=c(59561),w=c(27143),x=c(21947),y=c(61615),z=c(40618),A=c(73148);async function B(){let{userId:a}=await (0,u.j)();if(!a)return new Response("Unauthorized",{status:401});if(!(0,w.Z)())return Response.json({reports:[],comments:[],isStaff:!1});let b=await (0,y.gP)(a),c=(0,w.f)(),d=await c`
    SELECT id, user_id, user_email, title, description, link_slug, priority, status, metadata, handled_by_user_id, handled_by_name, created_at, updated_at
    FROM reports
    WHERE status != 'deleted' AND (${b} OR user_id = ${a})
    ORDER BY created_at DESC;
  `,e=d.map(a=>a.id),f=e.length?await c`
        SELECT id, report_id, author_user_id, author_name, body, created_at
        FROM report_comments
        WHERE report_id = ANY(${e}::bigint[])
        ORDER BY created_at ASC;
      `:[];return Response.json({reports:d,comments:f,isStaff:b})}async function C(a){let{userId:b}=await (0,u.j)();if(!b)return new Response("Unauthorized",{status:401});if(!(0,w.Z)())return new Response("Database not configured",{status:500});let c=await a.json(),d=String(c.title??"").trim(),e=String(c.description??"").trim(),f=String(c.linkSlug??"").trim()||null,g=function(a){let b=String(a??"normal").toLowerCase();return["low","normal","high","urgent"].includes(b)?b:"normal"}(c.priority);if(!d||!e)return new Response("Title and description are required",{status:400});let h=await (0,A.Xl)(`${d} ${e} ${f??""}`);if(!h.isClean)return new Response(h.reason||"Content blocked by AutoMod",{status:400});await (0,x.k)();let i=(0,w.f)(),j=(await i`
    SELECT report_ban_type, banned_until, limit_hourly, limit_daily
    FROM reporting_profiles
    WHERE user_id = ${b}
  `)[0];if(j){let a=new Date,c="permanent"===j.report_ban_type,d="temporary"===j.report_ban_type&&null!==j.banned_until&&new Date(j.banned_until)>a;if(c||d)return new Response("You are banned from submitting reports.",{status:403});let e=(await i`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') AS hourly_count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS daily_count
      FROM reports
      WHERE user_id = ${b}
    `)[0];if(j.limit_hourly>0&&e.hourly_count>=j.limit_hourly)return new Response(`Report limit reached: you may submit up to ${j.limit_hourly} reports per hour.`,{status:429});if(j.limit_daily>0&&e.daily_count>=j.limit_daily)return new Response(`Report limit reached: you may submit up to ${j.limit_daily} reports per day.`,{status:429})}let k=await (0,v.$)(),l=await k.users.getUser(b),m=l.emailAddresses.find(a=>a.id===l.primaryEmailAddressId),n=await i`
    INSERT INTO reports (user_id, user_email, title, description, link_slug, priority, status, metadata)
    VALUES (
      ${b},
      ${m?.emailAddress??null},
      ${d},
      ${e},
      ${f},
      ${g},
      ${function(a){let b=String(a??"open").toLowerCase();return["open","investigating","resolved","closed"].includes(b)?b:"open"}("open")},
      ${c.metadata??null}
    )
    RETURNING id, user_id, user_email, title, description, link_slug, priority, status, metadata, handled_by_user_id, handled_by_name, created_at, updated_at;
  `;return await (0,z.yI)({action:"Report submitted",details:`${d}${f?` (${f})`:""}`,actorUserId:b}),Response.json({report:n[0]},{status:201})}let D=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/reports/route",pathname:"/api/reports",filename:"route",bundlePath:"app/api/reports/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\rodan\\Documents\\CVSD Assets\\cvsdgo\\app\\api\\reports\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:E,workUnitAsyncStorage:F,serverHooks:G}=D;function H(){return(0,g.patchFetch)({workAsyncStorage:E,workUnitAsyncStorage:F})}async function I(a,b,c){var d;let e="/api/reports/route";"/index"===e&&(e="/");let g=await D.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[C]);if(F&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||D.isDev||x||(G="/index"===(G=C)?"/":G);let H=!0===D.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>D.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>D.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await D.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await D.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await D.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},95736:(a,b,c)=>{"use strict";a.exports=c(44870)},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[5745,925,1568],()=>b(b.s=91305));module.exports=c})();