import"./components-WiGMM9E5.js";import{s as m}from"./supabaseClient-D8YZZJnc.js";const w="__none__";let I=new Set;async function B(){const{data:{user:s},error:n}=await m.auth.getUser();if(n||!s)return;const{data:e,error:t}=await m.from("user_account").select("user_id, full_name, role").eq("user_id",s.id).single();if(t){console.error("โหลดโปรไฟล์ผู้ใช้ไม่สำเร็จ:",t);return}e&&(document.getElementById("navProfileName").textContent=e.full_name,localStorage.setItem("currentUserName",e.full_name),localStorage.setItem("currentUserRole",e.role),localStorage.setItem("currentUserId",e.user_id))}function $(s){if(!s)return"ไม่ระบุวันที่";const n=new Date(s);if(isNaN(n.getTime()))return"ไม่ระบุวันที่";const e=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];return`${n.getDate()} ${e[n.getMonth()]} ${n.getFullYear()+543}`}async function D(){const s=document.getElementById("categoryCheckboxList"),{data:n,error:e}=await m.from("category").select("category_id, category_name").eq("is_active",!0).order("category_name",{ascending:!0});if(e||!n||n.length===0){s.innerHTML='<span style="font-size: 13px; color: #94a3b8;">ไม่พบหมวดหมู่ในระบบ</span>';return}s.innerHTML="",I=new Set(n.map(a=>String(a.category_id))),n.forEach(a=>{const r=document.createElement("label");r.className="checkbox-item",r.innerHTML=`
      <input type="checkbox" name="category" value="${a.category_id}" checked onchange="applyFilter()">
      <span>${a.category_name}</span>
    `,s.appendChild(r)});const t=document.createElement("label");t.className="checkbox-item",t.innerHTML=`
    <input type="checkbox" name="category" value="${w}" checked onchange="applyFilter()">
    <span>ไม่ระบุหมวดหมู่</span>
  `,s.appendChild(t)}async function H(){const{data:s,error:n}=await m.from("item").select(`
      item_id, item_name, description, image_url, status, created_at,
      category_id, category:category_id(category_name),
      storage:current_storage_id(storage_name, room),
      report(report_type, incident_location, incident_datetime, user:user_id(full_name))
    `).neq("status","คืนสำเร็จ").neq("status","หมดอายุ/ทำลายทิ้ง");if(n){console.error("Error fetching items:",n);const t=document.getElementById("itemsGrid");return t.innerHTML=`
      <div style="grid-column: 1 / -1; padding: 30px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; color: #be123c;">
        <strong>โหลดข้อมูลไม่สำเร็จ</strong>
        <p style="margin-top: 8px;">${n.message}</p>
      </div>
    `,[]}const e=s.map(t=>{var r;const a=Array.isArray(t.report)&&t.report.length>0?t.report[0]:null;return{id:t.item_id,title:t.item_name||"ไม่ระบุชื่อสิ่งของ",description:t.description,categoryName:t.category&&t.category.category_name||"หมวดหมู่ทั่วไป",categoryId:t.category_id?String(t.category_id):"",storageName:t.storage&&t.storage.storage_name||"",locationText:a&&a.incident_location||((r=t.storage)==null?void 0:r.storage_name)||"ไม่ระบุสถานที่",image_url:t.image_url,timestamp:a&&a.incident_datetime?new Date(a.incident_datetime).toISOString():new Date(t.created_at).toISOString(),type:a?a.report_type:"found",status:t.status||"รอตรวจสอบ",poster:a&&a.user&&a.user.full_name||"ผู้แจ้งประกาศ"}});return e.sort((t,a)=>new Date(a.timestamp)-new Date(t.timestamp)),e}async function p(){const s=await H(),n=document.getElementById("itemsGrid");if(n.innerHTML="",s.length===0){document.getElementById("resultCountText").textContent="พบ 0 รายการ",document.getElementById("noResults").style.display="block";return}s.forEach(e=>{let t="badge-pending",a="fa-solid fa-clock";switch(e.status){case"อยู่ที่จุดรับฝาก":t="badge-storage",a="fa-solid fa-box-archive";break;case"กำลังดำเนินการเคลม":t="badge-claiming",a="fa-solid fa-spinner";break;case"คืนสำเร็จ":t="badge-returned",a="fa-solid fa-check-circle";break;case"หมดอายุ/ทำลายทิ้ง":t="badge-disposed",a="fa-solid fa-trash";break;default:t="badge-pending",a="fa-solid fa-clock"}const r=e.type==="lost",u=r?'<span class="item-badge badge-lost"><i class="fa-solid fa-magnifying-glass"></i> แจ้งหาย</span>':`<span class="item-badge ${t}"><i class="${a}"></i> ${e.status}</span>`,g=e.image_url?`<img src="${e.image_url}" alt="${e.title}">`:`<div class="no-image-placeholder">
           <i class="fa-solid fa-image"></i>
           <span>ไม่มีรูปภาพ</span>
         </div>`,l=I.has(e.categoryId)?e.categoryId:w,o=document.createElement("div");o.className="item-card",o.setAttribute("data-type",e.type),o.setAttribute("data-category",l),o.setAttribute("data-location-name",e.locationText),o.setAttribute("data-date",e.timestamp.split("T")[0]),o.setAttribute("data-status",r?"แจ้งหาย":e.status),o.setAttribute("data-title",e.title),o.innerHTML=`
      <div class="item-image-wrapper">
        ${g}
        ${u}
      </div>
      <div class="item-body">
        <div class="item-info">
          <h3 class="item-title">${e.title}</h3>
          <div class="item-category">${e.categoryName}</div>
          <div class="item-meta">
            <span><i class="fa-regular fa-calendar"></i> ${$(e.timestamp)}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${e.locationText}</span>
          </div>
        </div>
        <a href="detail.html?id=${e.id}" class="btn-detail">
          <span>ดูรายละเอียด</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `,n.appendChild(o)}),y()}function y(){const s=Array.from(document.querySelectorAll('input[name="type_status"]:checked')).map(c=>c.value),n=Array.from(document.querySelectorAll('input[name="category"]:checked')).map(c=>c.value),e=document.getElementById("statusFilter").value,t=document.getElementById("dateFilter").value,a=document.getElementById("locationSearchInput")?document.getElementById("locationSearchInput").value.trim().toLowerCase():"",r=document.getElementById("searchInput")?document.getElementById("searchInput").value.trim().toLowerCase():"",u=new Date;u.setHours(0,0,0,0);const g=document.querySelectorAll(".item-card");let l=0;g.forEach(c=>{const v=c.getAttribute("data-type"),E=c.getAttribute("data-category"),f=(c.getAttribute("data-location-name")||"").toLowerCase(),L=c.getAttribute("data-date"),h=c.getAttribute("data-status")||"",T=c.getAttribute("data-title").toLowerCase(),b=new Date(L);b.setHours(0,0,0,0);const C=u-b,i=Math.floor(C/(1e3*60*60*24)),S=s.length===0||s.includes(v),x=n.length===0||n.includes(E);let _=!0;e!=="all"&&(_=h===e);let d=!0;t==="today"?d=i===0:t==="yesterday"?d=i===1:t==="7days"?d=i>=0&&i<=7:t==="30days"&&(d=i>=0&&i<=30);const k=a===""||f.includes(a),A=r===""||T.includes(r)||f.includes(r)||h.toLowerCase().includes(r);S&&x&&_&&d&&k&&A?(c.classList.remove("hidden"),l++):c.classList.add("hidden")}),document.getElementById("resultCountText").textContent=`พบ ${l} รายการ`;const o=document.getElementById("noResults");o&&(o.style.display=l===0?"block":"none")}window.applyFilter=y;window.renderBrowseItems=p;document.addEventListener("DOMContentLoaded",async()=>{await B(),await D(),await p();const n=new URLSearchParams(window.location.search).get("search");n&&(document.getElementById("searchInput").value=n),y();const e=document.getElementById("btnRefresh")||document.querySelector(".btn-refresh");e&&e.addEventListener("click",async()=>{e.disabled=!0;const t=e.innerHTML;e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...',await p(),e.disabled=!1,e.innerHTML=t})});
