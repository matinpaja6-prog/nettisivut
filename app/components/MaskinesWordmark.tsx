type MaskinesWordmarkProps = {
  className?: string;
};

/** The Maskines wordmark as reusable vector letters, not an image. */
export default function MaskinesWordmark({ className }: MaskinesWordmarkProps) {
  return (
    <svg className={className} viewBox="0 0 438 52" fill="none" aria-hidden="true" focusable="false">
      <path d="M0 52V0h11.4l14.6 20L40.6 0H52v52H40.4V19.2L27.3 37.5h-2.6L11.6 19.2V52H0Z" fill="currentColor" />
      <path className="maskines-wordmark-accent" d="M55 52 80.3 0h8.4L114 52H99.6L84.5 18.2 69.4 52H55Z" fill="#ff7417" />
      <path d="M120 52V40.6h32.3c3.2 0 5.2-1.5 5.2-4.1 0-2.3-1.4-3.7-4.4-3.7h-20.2c-9.3 0-14.4-5.1-14.4-15.5C118.5 6.3 124.6 0 135.1 0h33.4v11.4h-31.6c-3.4 0-5.3 1.8-5.3 4.5 0 2.7 1.8 4.2 5.3 4.2h19.6c9.3 0 14.3 5.2 14.3 15.5 0 10.3-5.9 16.4-17.3 16.4H120Z" fill="currentColor" />
      <path d="M180 52V0h12.3v20.8L215.1 0H231l-23.4 25.4L232 52h-16.2l-19.1-21.1-4.4 4.7V52H180Z" fill="currentColor" />
      <path d="M240 52V0h12.4v52H240Z" fill="currentColor" />
      <path d="M264 52V0h11.2l29.2 31.4V0H317v52h-10.8L276.6 20v32H264Z" fill="currentColor" />
      <path className="maskines-wordmark-accent" d="M329 0h47v10.5h-47V0Zm0 20.8h47v10.5h-47V20.8Zm0 20.7h47V52h-47V41.5Z" fill="#ff7417" />
      <path d="M383 52V40.6h32.3c3.2 0 5.2-1.5 5.2-4.1 0-2.3-1.4-3.7-4.4-3.7h-20.2c-9.3 0-14.4-5.1-14.4-15.5C381.5 6.3 387.6 0 398.1 0h33.4v11.4h-31.6c-3.4 0-5.3 1.8-5.3 4.5 0 2.7 1.8 4.2 5.3 4.2h19.6c9.3 0 14.3 5.2 14.3 15.5 0 10.3-5.9 16.4-17.3 16.4H383Z" fill="currentColor" />
    </svg>
  );
}
