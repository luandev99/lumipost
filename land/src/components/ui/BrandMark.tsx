import Image from "next/image";

/** Mesma marca do app (src/presentation/ui/index.tsx → BrandMark). */
export default function BrandMark({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? 34 : 44;
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/assets/logo.png"
        alt=""
        width={size}
        height={size}
        priority
        className={`${compact ? "h-8 w-8" : "h-10 w-10"} object-contain drop-shadow-[0_0_18px_rgba(169,112,255,0.45)]`}
      />
      <span
        className={`${compact ? "text-[16px]" : "text-[19px]"} font-bold tracking-tight`}
      >
        lumi<span className="text-app-primary">post</span>
      </span>
    </span>
  );
}
