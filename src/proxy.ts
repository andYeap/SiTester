import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/pengujian-baru") ||
    pathname.startsWith("/riwayat") ||
    pathname.startsWith("/fitur") ||
    pathname.startsWith("/permohonan") ||
    pathname.startsWith("/pengguna") ||
    pathname.startsWith("/peran") ||
    pathname.startsWith("/siklus") ||
    pathname.startsWith("/aktivitas") ||
    pathname.startsWith("/notifikasi") ||
    pathname.startsWith("/defect") ||
    pathname.startsWith("/impor") ||
    pathname.startsWith("/profil");

  if (isAppRoute && !request.cookies.has("testlab_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Hanya route aplikasi yang butuh cek cookie; jangan jalankan proxy untuk
  // /api, aset statis, login, dan halaman publik (mengurangi latensi Vercel).
  matcher: [
    "/",
    "/dashboard/:path*",
    "/pengujian-baru/:path*",
    "/riwayat/:path*",
    "/fitur/:path*",
    "/defect/:path*",
    "/ai-test/:path*",
    "/permohonan/:path*",
    "/pengguna/:path*",
    "/peran/:path*",
    "/siklus/:path*",
    "/impor/:path*",
    "/aktivitas/:path*",
    "/notifikasi/:path*",
    "/profil/:path*",
  ],
};
