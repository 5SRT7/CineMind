"use client";

import { useState } from "react";
import type { CastMember } from "@/lib/types";
import { tmdbImageUrl } from "@/lib/utils";

export function CastAvatar({ person }: { person: CastMember }) {
  const [failed, setFailed] = useState(false);
  const src = tmdbImageUrl(person.profile_path, "w185");
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-line bg-panel-2">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={person.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2c303a] to-[#12141a] text-lg font-extrabold text-foreground/80">
            {person.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{person.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
          {person.character || "—"}
        </p>
      </div>
    </div>
  );
}
