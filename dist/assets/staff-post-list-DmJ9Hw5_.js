import"./components-WiGMM9E5.js";import"./staff-auth-Bx19Ogze.js";import{s as d}from"./supabaseClient-D8YZZJnc.js";const l="item",m="item_media",u={รอตรวจสอบ:{icon:"fa-clock",class:"status-pending"},อยู่ที่จุดรับฝาก:{icon:"fa-box-archive",class:"status-stored"},กำลังดำเนินการเคลม:{icon:"fa-hourglass-half",class:"status-claiming"},คืนสำเร็จ:{icon:"fa-circle-check",class:"status-returned"},"หมดอายุ/ทำลายทิ้ง":{icon:"fa-trash",class:"status-expired"}},f=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."],p="รอตรวจสอบ";let a=[];function g(t){if(!t)return"-";const e=new Date(t);if(Number.isNaN(e.getTime()))return"-";const n=e.getDate(),r=f[e.getMonth()],c=e.getFullYear()+543;return`${n} ${r} ${c}`}function _(t){const e=u[t]||{icon:"fa-circle-question",class:"status-pending"};return`<span class="pl-badge ${e.class}"><i class="fa-solid ${e.icon}"></i>${t||"-"}</span>`}function h(t){return`
    <article class="pl-card">
      <div class="pl-card-image">
        ${t.thumbnailUrl?`<img src="${t.thumbnailUrl}" alt="${t.item_name||""}">`:'<div class="pl-card-noimage"><i class="fa-regular fa-image"></i><span>ไม่มีรูปภาพ</span></div>'}
        ${_(t.status)}
      </div>
      <div class="pl-card-body">
        <h3 class="pl-card-title">${t.item_name||"-"}</h3>
        <p class="pl-card-category">${t.category||"-"}</p>
        <div class="pl-card-meta"><i class="fa-regular fa-calendar"></i>${g(t.found_date_time)}</div>
        <div class="pl-card-meta"><i class="fa-solid fa-location-dot"></i>${t.found_location||t.location_zone||"-"}</div>
        <a class="pl-card-btn" href="staff-post-detail.html?id=${encodeURIComponent(t.item_id)}">
          ดูรายละเอียด <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    </article>
  `}function y(){const t=document.getElementById("postGrid"),e=document.getElementById("emptyState");t.innerHTML=a.map(h).join(""),e.classList.toggle("hidden",a.length>0)}async function $(){const t=document.getElementById("loadingState");t.classList.remove("hidden");try{const{data:e,error:n}=await d.from(l).select("item_id, reference_id, item_name, category, status, found_location, found_date_time, created_at, report!inner(report_type)").eq("status",p).eq("report.report_type","found").is("deleted_at",null).order("created_at",{ascending:!1});if(n)throw n;if(a=e||[],a.length){const r=a.map(i=>i.item_id),{data:c,error:o}=await d.from(m).select("item_id, url, created_at").in("item_id",r).order("created_at",{ascending:!0});if(!o&&c){const i={};c.forEach(s=>{i[s.item_id]||(i[s.item_id]=s.url)}),a=a.map(s=>({...s,thumbnailUrl:i[s.item_id]||null}))}}y()}catch(e){console.error("โหลดรายการไม่สำเร็จ:",e),document.getElementById("postGrid").innerHTML="",document.getElementById("emptyState").classList.remove("hidden")}finally{t.classList.add("hidden")}}document.addEventListener("DOMContentLoaded",()=>{$()});
