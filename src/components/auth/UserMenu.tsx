"use client";

import { useAuth } from "./AuthProvider";

export function UserMenu() {
  const { enabled, user, signOut } = useAuth();

  if (!enabled) {
    return (
      <span
        className="glass rounded-full px-3 py-1.5 text-[12px] text-secondary"
        title="Add Supabase keys to .env.local to turn on accounts. Likes are saved in this browser for now."
      >
        Guest mode
      </span>
    );
  }
  if (!user) return null;

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Account";
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  return (
    <div className="glass flex items-center gap-2 rounded-full py-1 pr-1 pl-3">
      <span className="max-w-[140px] truncate text-[13px]">{name}</span>
      <button onClick={signOut} className="rounded-full bg-white/10 px-3 py-1 text-[12px] transition hover:bg-white/20">
        Sign out
      </button>
      {avatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
      )}
    </div>
  );
}
