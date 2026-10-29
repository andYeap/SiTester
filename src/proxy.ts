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
    pathname.startsWith("/profil");

  if (isAppRoute && !request.cookies.has("testlab_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
