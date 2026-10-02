import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const rootDir = dirname(fileURLToPath(import.meta.url));

// ทุกหน้าของเว็บไซต์ (ผู้ใช้ + เจ้าหน้าที่) รวม 20 หน้า
const pages = [
  // ---- ฝั่งผู้ใช้ ----
  'home',
  'browse',
  'activity',
  'claim',
  'detail',
  'report',
  'report2',
  'report3',
  'profile',
  'login',
  'register',
  'forgotpassword',

  // ---- ฝั่งเจ้าหน้าที่ ----
  'staff-dashboard',
  'staff-post-list',
  'staff-post-detail',
  'staff-inventory-add',
  'staff-verify-claims',
  'staff-verify-detail',
  'staff-handover',
  'staff-overdue-list',
  'staff-dispose-item',
  'staff-profile',

  // ---- ���ุ��แอด��ิน ----
  'admin-storage-points',
];

export default defineConfig({
  // ให้ vite มองเห็นไฟล์ใน src/ เป็น public assets เพื่อให้ path แบบ
  // relative (css/..., js/..., images.staff/...) ทำงานทั้ง dev และ build
  publicDir: false,

  server: {
    port: 5173,
    open: '/src/login.html',
    fs: {
      allow: [rootDir],
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((name) => [name, resolve(rootDir, 'src', `${name}.html`)])
      ),
    },
  },
});
