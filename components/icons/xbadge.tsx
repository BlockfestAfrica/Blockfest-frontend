export function XBadge() {
  return (
    <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white">
        <path d="M18.9 2H22l-7.7 8.8L23.3 22h-7.2l-5.6-7.3L4 22H1l8.2-9.4L.8 2h7.4l5.1 6.7L18.9 2Zm-1.3 18h2L6.5 4H4.4l13.2 16Z" />
      </svg>
    </span>
  );
}