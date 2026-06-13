(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,713709,e=>{"use strict";e.i(562716);var t=e.i(438030);let o=null;async function n(e){if(o&&o.companyId===e&&Date.now()-o.ts<6e4)return o.configs;let n=await (0,t.getIntegrationsConfig)(e)??[];return o={companyId:e,configs:n,ts:Date.now()},n}async function i(e,t){let o=(await n(e)).find(e=>e.provider===t&&e.is_active);return o?o.config:null}async function r(e){return i(e,"email")}async function a(e){return i(e,"whatsapp")}async function s(e){return i(e,"twilio")}async function l(e){return i(e,"onesignal")}async function c(e){return i(e,"checkr")}async function p(e){return i(e,"docusign")}async function m(e){return i(e,"gusto")}async function f(e,t){return(await n(e)).some(e=>e.provider===t&&e.is_active)}e.s(["getActiveConfig",0,i,"getCheckrConfig",0,c,"getDocuSignConfig",0,p,"getEmailConfig",0,r,"getGustoConfig",0,m,"getOneSignalConfig",0,l,"getTwilioConfig",0,s,"getWhatsAppConfig",0,a,"isIntegrationActive",0,f])},756939,e=>{"use strict";var t=e.i(713709);async function o(e,t){try{let o=await fetch("https://api.postmarkapp.com/email",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","X-Postmark-Server-Token":e.api_key},body:JSON.stringify({From:e.from_name?`${e.from_name} <${e.from_email}>`:e.from_email,To:t.to,Subject:t.subject,HtmlBody:t.html,TextBody:t.text??r(t.html),MessageStream:"outbound"})});if(!o.ok){let e=await o.text();return console.error("[Email/Postmark] Send failed:",o.status,e),!1}return!0}catch(e){return console.error("[Email/Postmark] Network error:",e),!1}}async function n(e,t){try{let o=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e.api_key}`},body:JSON.stringify({from:e.from_name?`${e.from_name} <${e.from_email}>`:e.from_email,to:[t.to],subject:t.subject,html:t.html,text:t.text??r(t.html)})});if(!o.ok){let e=await o.text();return console.error("[Email/Resend] Send failed:",o.status,e),!1}return!0}catch(e){return console.error("[Email/Resend] Network error:",e),!1}}async function i(e,i){let r=await (0,t.getEmailConfig)(e);return r?"postmark"===r.provider?o(r,i):"resend"===r.provider?n(r,i):(console.warn("[Email] Unknown provider:",r.provider),!1):(console.warn("[Email] No active email integration for company",e),!1)}function r(e){return e.replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim()}e.s(["buildShiftReminderEmail",0,function(e){let{firstName:t,companyName:o,shiftDate:n,shiftTime:i,location:r}=e,a=`
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h2 style="font-size:18px;margin-bottom:4px;">Shift Reminder</h2>
      <p style="font-size:14px;line-height:1.6;">Hi ${t}, you have an upcoming shift:</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;"><strong>Date:</strong> ${n}</p>
        <p style="margin:4px 0 0;font-size:14px;"><strong>Time:</strong> ${i}</p>
        ${r?`<p style="margin:4px 0 0;font-size:14px;"><strong>Location:</strong> ${r}</p>`:""}
      </div>
      <p style="font-size:12px;color:#999;">— ${o} via Overwatch</p>
    </div>
  `;return{to:"",subject:`Shift Reminder — ${n} at ${i}`,html:a}},"buildWelcomeEmail",0,function(e){let{firstName:t,companyName:o,joinCode:n,appUrl:i,communityLink:r}=e,a=`
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h1 style="font-size:22px;margin-bottom:4px;">Welcome to ${o}!</h1>
      <p style="color:#666;font-size:14px;">You've been hired — here's how to get started.</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:14px;line-height:1.6;">Hi ${t},</p>
      <p style="font-size:14px;line-height:1.6;">Congratulations! Your account has been set up on <strong>Overwatch</strong>, our workforce management platform. Here's what to do next:</p>
      <ol style="font-size:14px;line-height:1.8;padding-left:20px;">
        <li>Go to <a href="${i}/register" style="color:#2563eb;">${i}/register</a> and create your account using this email address.</li>
        <li>Use join code <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${n}</strong> to join the team.</li>
        <li>Complete your onboarding checklist in the app.</li>
      </ol>
      ${r?`<p style="font-size:14px;line-height:1.6;">Join our team chat: <a href="${r}" style="color:#2563eb;">${r}</a></p>`:""}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">This email was sent by ${o} via Overwatch.</p>
    </div>
  `;return{to:"",subject:`Welcome to ${o} — Get Started on Overwatch`,html:a}},"sendEmail",0,i])}]);