/** Refex One brand mark for navbar / sidebar */
export const BRAND_LOGO_URL =
  (import.meta.env.VITE_BRAND_LOGO_URL as string | undefined)?.trim() ||
  '/refexone-logo.png';

type BrandLogoProps = {
  className?: string;
  imgClassName?: string;
  collapsed?: boolean;
};

export default function BrandLogo({
  className = '',
  imgClassName = 'h-7 sm:h-8 w-auto max-w-[140px] sm:max-w-[168px] object-contain object-left',
  collapsed = false,
}: BrandLogoProps) {
  if (collapsed) {
    return (
      <img
        src={BRAND_LOGO_URL}
        alt="refex one"
        className={`h-7 w-7 object-cover object-left rounded-sm ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center min-w-0 ${className}`}>
      <img src={BRAND_LOGO_URL} alt="refex one" className={imgClassName} />
    </div>
  );
}
