import"./components-WiGMM9E5.js";import{s as _}from"./supabaseClient-D8YZZJnc.js";function L(){return localStorage.getItem("currentUserId")||localStorage.getItem("userId")||localStorage.getItem("user_id")||null}function h(t){if(!t)return"-";const e=new Date(t);if(isNaN(e.getTime()))return"-";const i=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];return`${e.getDate()} ${i[e.getMonth()]} ${e.getFullYear()+543}`}const w="https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=600&auto=format&fit=crop";function I(t){switch(t){case"อยู่ที่จุดรับฝาก":return{cls:"pending",icon:"fa-regular fa-clock"};case"กำลังดำเนินการเคลม":return{cls:"progress",icon:"fa-solid fa-arrows-rotate"};case"คืนสำเร็จ":return{cls:"success",icon:"fa-regular fa-circle-check"};case"หมดอายุ/ทำลายทิ้ง":return{cls:"expired",icon:"fa-solid fa-trash"};case"รอตรวจสอบ":default:return{cls:"warning",icon:"fa-regular fa-circle-question"}}}function o(t,e,i="fa-regular fa-folder-open"){const c=document.getElementById("activityList");c&&(c.innerHTML=`
      <div class="empty-box">
        <i class="${i}"></i>
        <h3>${t}</h3>
        <p>${e}</p>
      </div>
    `)}function y(){const t=document.getElementById("activityList");t&&(t.innerHTML=`
      <div class="empty-box">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <h3>กำลังโหลดข้อมูล...</h3>
        <p>กรุณารอสักครู่</p>
      </div>
    `)}async function C(t){y();const{data:e,error:i}=await _.from("report").select(`
      report_id,
      report_type,
      incident_location,
      incident_datetime,
      item_id,
      item:item_id ( item_name, description, status, image_url, deleted_at )
    `).eq("user_id",t).order("incident_datetime",{ascending:!1});if(i){console.error("โหลดประกาศของฉันไม่สำเร็จ:",i),o("โหลดข้อมูลไม่สำเร็จ","กรุณาลองรีเฟรชหน้าใหม่อีกครั้ง","fa-solid fa-triangle-exclamation");return}const c=(e||[]).filter(a=>!a.item||!a.item.deleted_at);if(c.length===0){o("ยังไม่มีรายการที่คุณแจ้งประกาศ","คุณยังไม่ได้สร้างประกาศแจ้งหายหรือแจ้งพบสิ่งของในระบบด้วยบัญชีนี้");return}const r=document.getElementById("activityList");r&&(r.innerHTML="",c.forEach(a=>{const l=a.report_type==="lost",s=l?"lost":"found",m=l?"แจ้งหาย":"พบเจอ",u=a.item&&a.item.item_name||"ไม่พบชื่อสิ่งของ",p=a.item&&a.item.description||"ไม่มีรายละเอียดเพิ่มเติม",f=a.item&&a.item.status||"รอตรวจสอบ",g=a.item&&a.item.image_url||w,{cls:n,icon:b}=I(f),d=document.createElement("div");d.className="activity-card",d.style.cursor="pointer",d.onclick=()=>window.location.href=`detail.html?id=${a.item_id}`,d.innerHTML=`
      <div class="card-main-row">
        <div class="card-img-box">
          <img src="${g}" alt="${u}">
        </div>
        <div class="card-content-box">
          <div class="card-top-row">
            <h3 class="card-title">${u}</h3>
            <span class="badge-type ${s}">${m}</span>
          </div>
          <p class="card-desc">${p}</p>
          <div class="card-bottom-row">
            <div class="card-date">
              <i class="fa-regular fa-calendar"></i>
              <span>${h(a.incident_datetime)}</span>
            </div>
            <div class="status-indicator ${n}">
              <i class="${b}"></i>
              <span>${f}</span>
            </div>
          </div>
        </div>
      </div>
    `,r.appendChild(d)}))}async function E(t){y();const{data:e,error:i}=await _.from("claim").select(`
      claim_id,
      claim_status,
      created_at,
      ownership_evidence,
      item_id,
      item:item_id ( item_name, image_url )
    `).eq("user_id",t).order("created_at",{ascending:!1});if(i){console.error("โหลดคำร้องขอคืนของไม่สำเร็จ:",i),o("โหลดข้อมูลไม่สำเร็จ","กรุณาลองรีเฟรชหน้าใหม่อีกครั้ง","fa-solid fa-triangle-exclamation");return}if(!e||e.length===0){o("ยังไม่มีคำร้องขอคืนสิ่งของ","คุณยังไม่ได้ทำรายการอ้างสิทธิ์ความเป็นเจ้าของสิ่งของใดๆ ในระบบ","fa-regular fa-clipboard");return}const c=document.getElementById("activityList");if(!c)return;c.innerHTML="";const r={pending:"รอตรวจสอบ",approved:"อนุมัติแล้ว รอมารับของ",rejected:"ถูกปฏิเสธ",handed_over:"รับของเรียบร้อยแล้ว"},a={pending:"pending",approved:"progress",rejected:"warning",handed_over:"success"},l={pending:"fa-regular fa-clock",approved:"fa-solid fa-arrows-rotate",rejected:"fa-regular fa-circle-xmark",handed_over:"fa-regular fa-circle-check"};e.forEach(s=>{const m=s.item&&s.item.item_name||"ไม่พบชื่อสิ่งของ",u=s.item&&s.item.image_url||w,p=r[s.claim_status]||s.claim_status,f=a[s.claim_status]||"pending",g=l[s.claim_status]||"fa-regular fa-clock",n=document.createElement("div");n.className="activity-card",n.style.cursor="pointer",n.onclick=()=>window.location.href=`detail.html?id=${s.item_id}`,n.innerHTML=`
      <div class="card-main-row">
        <div class="card-img-box">
          <img src="${u}" alt="${m}">
        </div>
        <div class="card-content-box">
          <div class="card-top-row">
            <h3 class="card-title">${m}</h3>
          </div>
          <p class="card-desc">${s.ownership_evidence||"ไม่มีหลักฐานเพิ่มเติม"}</p>
          <div class="card-bottom-row">
            <div class="card-date">
              <i class="fa-regular fa-calendar"></i>
              <span>${h(s.created_at)}</span>
            </div>
            <div class="status-indicator ${f}">
              <i class="${g}"></i>
              <span>${p}</span>
            </div>
          </div>
        </div>
      </div>
    `,c.appendChild(n)})}function $(t="reported"){const e=L();if(!e){o("กรุณาเข้าสู่ระบบ","คุณต้องเข้าสู่ระบบก่อนจึงจะดูกิจกรรมส่วนตัวได้","fa-solid fa-circle-user");return}t==="reported"?C(e):E(e)}function v(t){const e=document.getElementById("tabReported"),i=document.getElementById("tabClaimed"),c=t==="reported";e&&i&&(c?(e.classList.add("active"),i.classList.remove("active")):(i.classList.add("active"),e.classList.remove("active"))),$(c?"reported":"claimed")}window.switchTab=v;document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("tabReported"),e=document.getElementById("tabClaimed");t&&t.addEventListener("click",()=>v("reported")),e&&e.addEventListener("click",()=>v("claimed")),$("reported")});
