import"./components-WiGMM9E5.js";import"./staff-auth-Bx19Ogze.js";import{s as L}from"./supabaseClient-D8YZZJnc.js";const b="claim";let u=[],g="all";const v={approved:{text:"อนุมัติแล้ว",action:"ดูรายละเอียด"},rejected:{text:"ปฏิเสธคำร้อง",action:"ดูรายละเอียด"},more_info:{text:"ขอข้อมูลเพิ่มเติม",action:"ดูรายละเอียด"},pending:{text:"รอตรวจสอบ",action:"ตรวจสอบ"}};function E(t){const e=String(t??"").trim().toLowerCase();return v[e]?e:"pending"}function F(t){return v[E(t)]}function d(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function h(t){if(!t)return"-";const e=new Date(t);if(Number.isNaN(e.getTime()))return"-";const n=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];return`${e.getDate()} ${n[e.getMonth()]} ${e.getFullYear()+543}`}function I(t){if(!t)return"";const e=new Date(t);return Number.isNaN(e.getTime())?"":e.toISOString().slice(0,10)}async function _(){const{data:t,error:e}=await L.from(b).select(`
      claim_id,
      claimant_name,
      status,
      note,
      created_at,
      item:item_id ( item_id, item_name, category, category_key, description )
    `).order("created_at",{ascending:!1});if(e)throw e;return t||[]}function $(t){const e=document.getElementById("dateFilter"),n=e.value,s=[...new Set(t.map(c=>I(c.created_at)).filter(Boolean))].sort((c,a)=>c<a?1:-1);e.innerHTML='<option value="all">วันที่ทั้งหมด</option>',s.forEach(c=>{const a=document.createElement("option");a.value=c,a.textContent=h(c),e.appendChild(a)}),s.includes(n)&&(e.value=n)}function w(t){const e=t.item||{},n=e.item_name||"ไม่ระบุชื่อสิ่งของ",s=e.description||"",c=e.category_key||e.category||"",a=t.claim_id||"-",r=E(t.status),i=F(r),m=I(t.created_at),o=document.createElement("tr");return o.className="claim-row",o.dataset.claimId=a,o.dataset.category=c,o.dataset.status=r,o.dataset.date=m,o.dataset.search=`${a} ${n} ${t.claimant_name||""}`.toLowerCase(),o.innerHTML=`
    <td class="claim-id-cell">${d(a)}</td>
    <td>
      <div class="item-cell">
        <div class="item-icon"><i class="fa-regular fa-image"></i></div>
        <div>
          <p class="item-name">${d(n)}</p>
          ${s?`<p class="item-desc">${d(s)}</p>`:""}
        </div>
      </div>
    </td>
    <td class="claimant-cell">${d(t.claimant_name||"-")}</td>
    <td class="date-cell">${h(t.created_at)}</td>
    <td>
      <span class="status-badge ${r}">
        <span class="dot"></span>
        ${i.text}
      </span>
    </td>
    <td class="center">
      <a href="staff-verify-detail.html?id=${encodeURIComponent(a)}" class="action-button ${r}">
        <i class="fa-regular fa-eye"></i>
        ${i.action}
      </a>
    </td>
  `,o}function S(t){const e=document.getElementById("claimTableBody");e.innerHTML="",t.forEach(n=>e.appendChild(w(n)))}function l(){const t=document.getElementById("categoryFilter").value,e=document.getElementById("dateFilter").value,n=document.getElementById("searchInput").value.trim().toLowerCase(),s=document.querySelectorAll(".claim-row");let c=0;s.forEach(a=>{const r=t==="all"||a.dataset.category===t,i=e==="all"||a.dataset.date===e,m=g==="all"||a.dataset.status===g,o=n===""||(a.dataset.search||"").includes(n),f=r&&i&&m&&o;a.style.display=f?"":"none",f&&(c+=1)}),document.getElementById("emptyState").classList.toggle("hidden",c!==0)}function y(){const t=document.getElementById("claimTableBody"),e=document.getElementById("sortFilter").value,n=Array.from(t.querySelectorAll(".claim-row"));n.sort((s,c)=>{const a=new Date(s.dataset.date||0),r=new Date(c.dataset.date||0);return e==="oldest"?a-r:r-a}),n.forEach(s=>t.appendChild(s)),l()}function B(t){g=t,document.querySelectorAll(".status-tab").forEach(e=>{e.classList.toggle("active",e.dataset.status===t)}),l()}function T(){document.getElementById("categoryFilter").value="all",document.getElementById("dateFilter").value="all",document.getElementById("searchInput").value="",document.getElementById("sortFilter").value="latest",B("all"),y()}async function p(){const t=document.getElementById("claimTableBody");try{u=await _(),$(u),S(u),y()}catch(e){console.error("เกิดข้อผิดพลาดในการโหลดข้อมูลคำร้อง:",e),t&&(t.innerHTML='<tr><td colspan="6" class="cell-error">ไม่สามารถโหลดข้อมูลได้ กรุณาลองรีเฟรชอีกครั้ง</td></tr>')}}document.addEventListener("DOMContentLoaded",()=>{var t,e,n,s,c;(t=document.getElementById("categoryFilter"))==null||t.addEventListener("change",l),(e=document.getElementById("dateFilter"))==null||e.addEventListener("change",l),(n=document.getElementById("sortFilter"))==null||n.addEventListener("change",y),(s=document.getElementById("searchInput"))==null||s.addEventListener("input",l),(c=document.getElementById("resetFiltersBtn"))==null||c.addEventListener("click",T),document.querySelectorAll(".status-tab").forEach(a=>{a.addEventListener("click",()=>B(a.dataset.status))}),p()});window.addEventListener("focus",p);document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&p()});
