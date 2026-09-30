"use strict";exports.id=6755,exports.ids=[6755],exports.modules={27143:(a,b,c)=>{c.d(b,{Z:()=>f,f:()=>g});var d=c(9608);let e=null;function f(){return!!process.env.DATABASE_URL}function g(){if(e)return e;let a=process.env.DATABASE_URL;if(!a)throw Error("DATABASE_URL environment variable is required for database operations.");return e=(0,d.lw)(a)}},40618:(a,b,c)=>{c.d(b,{dC:()=>n,jS:()=>k,yI:()=>o});var d=c(59561),e=c(27143),f=c(61615);let g=new Map;"undefined"!=typeof setInterval&&setInterval(()=>{let a=Date.now()-6e4;for(let[b,c]of g){let d=c.filter(b=>b>a);0===d.length?g.delete(b):g.set(b,d)}},3e5);let h=null;async function i(a){if(!a)return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1};let b=(0,f.ed)(a);if(b)return{username:b.username,hasDiscordAccount:b.hasDiscordAccount,hasLoginAccount:b.hasLoginAccount};try{let b=await (0,d.$)(),c=await b.users.getUser(a),e=[c.firstName,c.lastName].filter(Boolean).join(" ").trim(),f=c.username||e||c.emailAddresses[0]?.emailAddress||null,g=c.externalAccounts.some(a=>a.provider.toLowerCase().includes("discord")),h=!!c.passwordEnabled||c.emailAddresses.length>0||c.externalAccounts.length>0;return{username:f,hasDiscordAccount:g,hasLoginAccount:h}}catch{return{username:null,hasDiscordAccount:!1,hasLoginAccount:!1}}}function j(a){return"critical"===a?"critical":"warning"===a?"warning":"info"}function k(a){if(!a)return{actorIpAddress:null,actorUserAgent:null};let b=a.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??null,c=a.headers.get("x-real-ip")?.trim()??null;return{actorIpAddress:b??c,actorUserAgent:a.headers.get("user-agent")?.trim()??null}}async function l(){if(!(0,e.Z)())return null;let a=(0,e.f)(),b=await a`
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
    `,!d)return;let o=function(a,b){let c=a.action.toLowerCase(),d=b.toLowerCase();return"critical"===j(a.severity)||c.includes("delete")||c.includes("lock")||c.includes("ban")||c.includes("revoke")||c.includes("suspicious")||d.includes("mass")||d.includes("bulk")||d.includes("multiple")}(a,h);try{await fetch(d,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({allowed_mentions:{parse:[],users:[],roles:[]},embeds:[{title:`Audit: ${a.action}`,color:o?0xef4444:1920728,description:h,fields:[{name:"User",value:c||"Unknown user",inline:!0},{name:"Linked to Discord",value:a.actorHasDiscordAccount??b.hasDiscordAccount?"Yes":"No",inline:!0},{name:"Has login account",value:a.actorHasLoginAccount??b.hasLoginAccount?"Yes":"No",inline:!0},{name:"Severity",value:f,inline:!0},{name:"Action",value:a.action,inline:!1},{name:"Details",value:h,inline:!1}],timestamp:new Date().toISOString()}]})})}catch{}}catch{}}},86755:(a,b,c)=>{c.d(b,{oK:()=>j,So:()=>i,EN:()=>h,n5:()=>g,XQ:()=>k});var d=c(40618),e=c(27143);let f={terms:{key:"terms",label:"Terms of Service",title:"Terms of Service",route:"/terms-of-service",storageKey:"policy_terms_markdown",defaultMarkdown:`*Effective date: March 10, 2026*

These Terms of Service govern access to and use of CVSD Go, including the public link directory, short-link redirection, and staff administration tools operated by Cedar Valley School District ("District," "we," "our," "us"). By using CVSD Go, you agree to these terms.

## 1. Eligibility and Acceptable Use

CVSD Go is intended for students, families, staff, and community members seeking official district resources. You agree to use CVSD Go for lawful, educational, and administrative purposes only.

You must not use CVSD Go to:

- Publish malicious, fraudulent, deceptive, or unlawful destinations.
- Interfere with platform availability, security, or integrity.
- Attempt unauthorized access to staff-only tools or protected links.
- Use the service to distribute spam, malware, or harmful content.

## 2. Account and Access Controls

Some functions require authentication and role-based permissions. Staff users are responsible for safeguarding their credentials and for activities under their authenticated sessions.

The District may modify, suspend, or remove user access if misuse, policy violations, or security risks are detected.

## 3. Link Management and Content Responsibility

Authorized staff may create, edit, organize, schedule, lock, and remove short links. Staff users are responsible for verifying destination accuracy, appropriateness, and compliance with district policies.

The District may remove or disable any link, folder, or redirect that is outdated, unsafe, inaccurate, or inconsistent with educational mission or legal obligations.

## 4. Service Availability and Changes

CVSD Go is provided on an "as is" and "as available" basis. We may change features, URLs, folder structures, access rules, or integrations at any time to improve service quality, safety, or compliance.

We do not guarantee uninterrupted operation and may perform maintenance, updates, or emergency actions without prior notice.

## 5. Third-Party Destinations

CVSD Go may redirect to third-party websites and services. The District does not control third-party terms, privacy practices, accessibility, or content after redirection. Users should review destination policies before submitting personal information.

## 6. Security and Abuse Monitoring

To protect users and infrastructure, we may log technical events, monitor suspicious behavior, and audit administrative actions. Unauthorized testing, scraping, or attempts to bypass controls are prohibited.

## 7. Intellectual Property

District names, logos, branding, and original materials in CVSD Go are owned by Cedar Valley School District or licensed to it. No right is granted to reproduce or distribute branded assets except as allowed by law or written permission.

## 8. Disclaimer of Warranties and Limitation of Liability

To the maximum extent permitted by law, the District disclaims warranties of merchantability, fitness for a particular purpose, and non-infringement regarding CVSD Go and linked destinations.

The District is not liable for indirect, incidental, special, consequential, or exemplary damages arising from use of or inability to use CVSD Go, including losses associated with third-party sites.

## 9. Governing Rules and Policy Alignment

These terms operate alongside district board policy, student/employee handbooks, and applicable federal and state law. If there is a conflict, legal and district policy requirements control.

## 10. Contact

Questions about these terms or user rights may be sent to [office@cvsd.live](mailto:office@cvsd.live).

## 11. Updates to These Terms

We may revise these Terms of Service. Material changes will be posted on this page with an updated effective date.`},privacy:{key:"privacy",label:"Privacy Policy",title:"Privacy Policy",route:"/privacy-policy",storageKey:"policy_privacy_markdown",defaultMarkdown:`*Effective date: March 10, 2026*

Cedar Valley School District ("District," "we," "our," "us") values privacy and security. This Privacy Policy explains how CVSD Go collects, uses, shares, stores, and protects information when users access the link directory, short-link redirection services, and authenticated staff features.

## 1. Information We Collect

Depending on your use of CVSD Go, we may collect:

- Account identifiers for authenticated staff users (for example, user ID, display name, email).
- Administrative metadata (role flags, moderation actions, timestamps).
- Link records and operational fields (slug, destination URL, descriptions, schedules, access status).
- Technical usage events such as click counts, request timing, and security-related logs.
- Support submissions and comments entered through district support workflows.

## 2. How We Use Information

We process information to:

- Provide directory search and secure redirection functionality.
- Administer links, folders, permissions, and support workflows.
- Detect misuse, protect users, and maintain system security.
- Investigate incidents and comply with legal or policy requirements.
- Improve service quality, reliability, and accessibility.

## 3. Legal Basis and Education Context

CVSD Go is operated in an educational and public-service context. Processing may be based on public interest, legitimate educational operations, legal obligations, or user consent where required.

## 4. Sharing and Disclosure

We do not sell personal information. We may share data with approved service providers (for example, hosting, authentication, and infrastructure providers) under contractual or legal safeguards.

We may also disclose information when required by law, court order, records request obligations, or to protect the rights, safety, and security of students, staff, and systems.

## 5. Data Retention

We retain information only as long as needed for operational, educational, legal, audit, and security purposes. Retention periods may vary by record type and applicable regulation.

## 6. Security Measures

We apply administrative, technical, and organizational safeguards appropriate to the risk profile, including access controls, role-based permissions, logging, and infrastructure security practices.

No internet service can be guaranteed fully secure, but we continuously review and improve controls.

## 7. Children and Student Data

CVSD Go may be used by students and families to access district resources. Student information is handled in line with district obligations and applicable student privacy laws.

## 8. Third-Party Links and Services

CVSD Go redirects users to internal and external destinations. Once redirected, privacy practices are governed by the destination site. Review third-party privacy notices before sharing personal data.

## 9. Your Rights and Requests

Depending on applicable law, users may request access, correction, deletion, or restriction related to personal information processed through CVSD Go. We may need to verify identity before processing requests.

## 10. Contact

Privacy questions, rights requests, and security concerns can be sent to [office@cvsd.live](mailto:office@cvsd.live).

## 11. Policy Updates

We may update this Privacy Policy to reflect legal, operational, or technical changes. Updates will be posted on this page with a revised effective date.`}};function g(a){return"terms"===a||"privacy"===a}function h(a){return a.replace(/[\s#>*_\-`[\]{}()|!~]/g,"").trim().length>0}async function i(a){let b=f[a];if(!(0,e.Z)())return{key:a,label:b.label,title:b.title,route:b.route,storageKey:b.storageKey,markdown:b.defaultMarkdown,updatedAt:null,isDefault:!0};await (0,d.dC)();let c=(0,e.f)(),g=await c`
    SELECT setting_value, updated_at
    FROM site_settings
    WHERE setting_key = ${b.storageKey}
    LIMIT 1;
  `,h=g[0]?.setting_value?.trim();return{key:a,label:b.label,title:b.title,route:b.route,storageKey:b.storageKey,markdown:h&&h.length>0?h:b.defaultMarkdown,updatedAt:g[0]?.updated_at??null,isDefault:!h||0===h.length}}async function j(){return Object.fromEntries(await Promise.all(Object.keys(f).map(async a=>[a,await i(a)])))}async function k(a){if(!(0,e.Z)())throw Error("Database not configured.");if(!h(a.markdown))throw Error("Policy content cannot be empty.");let b=f[a.key];await (0,d.dC)();let c=(0,e.f)(),g=await c`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = ${b.storageKey}
    LIMIT 1;
  `,j=g[0]?.setting_value??null;await c`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (${b.storageKey}, ${a.markdown.trim()}, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();
  `;let k=(0,d.jS)(a.request);return await (0,d.yI)({action:"Policy updated",details:`${b.label} updated`,actorUserId:a.actorUserId,metadata:{policyKey:a.key,storageKey:b.storageKey,previousLength:j?.length??0,newLength:a.markdown.trim().length},severity:"info",category:"policies",source:"policy-editor",actorIpAddress:k.actorIpAddress,actorUserAgent:k.actorUserAgent}),i(a.key)}}};