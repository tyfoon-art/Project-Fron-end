import"./components-WiGMM9E5.js";import{s as $}from"./supabaseClient-D8YZZJnc.js";const E=6;function I(a){if(!a)return"ไม่ระบุวันที่";const e=new Date(a);if(isNaN(e.getTime()))return"ไม่ระบุวันที่";const o=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];return`${e.getDate()} ${o[e.getMonth()]} ${e.getFullYear()+543}`}function v(a){if(!a)return"";const e=new Date(a);if(isNaN(e.getTime()))return"";const o=e.getFullYear(),i=String(e.getMonth()+1).padStart(2,"0"),c=String(e.getDate()).padStart(2,"0");return`${o}-${i}-${c}`}async function k(){try{const{data:a,error:e}=await $.from("item").select(`
        item_id,
        item_name,
        description,
        image_url,
        status,
        created_at,
        category:category_id ( category_name ),
        storage_point:current_storage_id ( storage_name ),
        report ( report_type, incident_location, incident_datetime )
      `).is("deleted_at",null);if(e)throw e;return a||[]}catch(a){return console.error("เกิดข้อผิดพลาดในการโหลดข้อมูลสิ่งของ:",a),[]}}async function x(){try{const{count:a,error:e}=await $.from("item").select("item_id",{count:"exact",head:!0}).eq("status","คืนสำเร็จ").is("deleted_at",null);if(e)throw e;return a||0}catch(a){return console.error("เกิดข้อผิดพลาดในการนับจำนวนส่งคืนสำเร็จ:",a),0}}async function L(){const a=await k(),e=await x(),o=v(new Date);let i=0,c=0;const g=a.filter(t=>t.status!=="คืนสำเร็จ"&&t.status!=="หมดอายุ/ทำลายทิ้ง");g.forEach(t=>{const r=Array.isArray(t.report)?t.report[0]:t.report,n=(r==null?void 0:r.incident_datetime)||t.created_at;v(n)===o&&i++,["รอตรวจสอบ","อยู่ที่จุดรับฝาก","กำลังดำเนินการเคลม"].includes(t.status)&&c++}),g.sort((t,r)=>{const n=Array.isArray(t.report)?t.report[0]:t.report,l=Array.isArray(r.report)?r.report[0]:r.report,p=new Date((n==null?void 0:n.incident_datetime)||t.created_at).getTime();return new Date((l==null?void 0:l.incident_datetime)||r.created_at).getTime()-p});const m=g.slice(0,E),d=document.getElementById("recentItemsContainer");d&&(d.innerHTML="",m.length===0?d.innerHTML=`
      <div class="empty-today-box">
        <i class="fa-regular fa-calendar-xmark"></i>
        <h3>ยังไม่มีรายการแจ้งพบสิ่งของ</h3>
        <p>รายการที่พบในอดีตสามารถค้นหาและตรวจสอบได้ในหน้าค้นหาและฟิลเตอร์</p>
        <a href="browse.html" class="btn-browse-history">
          <span>ไปที่หน้าค้นหาและฟิลเตอร์</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `:m.forEach(t=>{var y,_,h,b;let r="badge-pending",n="fa-solid fa-clock";switch(t.status){case"อยู่ที่จุดรับฝาก":r="badge-storage",n="fa-solid fa-box-archive";break;case"กำลังดำเนินการเคลม":r="badge-claiming",n="fa-solid fa-spinner";break;case"คืนสำเร็จ":r="badge-returned",n="fa-solid fa-check-circle";break;case"หมดอายุ/ทำลายทิ้ง":r="badge-disposed",n="fa-solid fa-trash";break;default:r="badge-pending",n="fa-solid fa-clock"}const f=(Array.isArray(t.report)?((y=t.report[0])==null?void 0:y.report_type)??"found":((_=t.report)==null?void 0:_.report_type)??"found")==="lost"?'<span class="item-badge badge-lost"><i class="fa-solid fa-magnifying-glass"></i> แจ้งหาย</span>':`<span class="item-badge ${r}"><i class="${n}"></i> ${t.status}</span>`,s=Array.isArray(t.report)?t.report[0]:t.report,w=(s==null?void 0:s.incident_location)||((h=t.storage_point)==null?void 0:h.storage_name)||"ไม่ระบุสถานที่",T=((b=t.category)==null?void 0:b.category_name)||"หมวดหมู่ทั่วไป",C=(s==null?void 0:s.incident_datetime)||t.created_at,A=t.image_url?`<img src="${t.image_url}" alt="${t.item_name}">`:`<div class="no-image-placeholder">
             <i class="fa-solid fa-image"></i>
             <span>ไม่มีรูปภาพ</span>
           </div>`,u=document.createElement("div");u.className="item-card",u.innerHTML=`
        <div class="item-image-wrapper">
          ${A}
          ${f}
        </div>
        <div class="item-body">
          <div class="item-info">
            <h3 class="item-title">${t.item_name}</h3>
            <div class="item-category">${T}</div>
            <div class="item-meta">
              <span><i class="fa-regular fa-calendar"></i> ${I(C)}</span>
              <span><i class="fa-solid fa-location-dot"></i> ${w}</span>
            </div>
          </div>
          <a href="detail.html?id=${t.item_id}" class="btn-detail">
            <span>ดูรายละเอียด</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        </div>
      `,d.appendChild(u)}),document.getElementById("statTodayFound").textContent=i,document.getElementById("statReturnedSuccess").textContent=e,document.getElementById("statOpenItems").textContent=c)}document.addEventListener("DOMContentLoaded",L);
