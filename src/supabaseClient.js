// src/supabaseClient.js
// ไฟล์กลางสำหรับสร้าง Supabase client ตัวเดียว ให้ทุกหน้า import ไปใช้ร่วมกัน
// อย่าไปสร้าง createClient() ซ้ำในแต่ละหน้าอีก เพราะจะทำให้ URL/Key กระจัดกระจาย แก้ยาก

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // เตือนตั้งแต่ dev time ถ้าลืมตั้งค่า .env หรือชื่อตัวแปรพิมพ์ผิด
  console.error(
    'ไม่พบ VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY ใน .env — ตรวจสอบว่าไฟล์ .env ' +
    'อยู่ที่ root ของโปรเจกต์ และรีสตาร์ท dev server หลังแก้ .env แล้ว'
  );
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);