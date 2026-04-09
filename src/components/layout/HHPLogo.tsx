export default function HHPLogo({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="195" fill="#0a1628"/>
      <circle cx="200" cy="200" r="195" fill="none" stroke="#d4a843" strokeWidth="4.5"/>
      <path d="M200 62 L308 98 L308 215 Q308 302 200 350 Q92 302 92 215 L92 98 Z"
            fill="#1a3a6b" stroke="#d4a843" strokeWidth="3"/>
      <path d="M 132,162 L 132,98 A 11,11 0 0,1 143,87 L 257,87 A 11,11 0 0,1 268,98 L 268,162 Z"
            fill="white" opacity="0.94"/>
      <line x1="200" y1="87" x2="200" y2="163" stroke="#999999" strokeWidth="7" strokeLinecap="round"/>
      <line x1="200" y1="87" x2="200" y2="163" stroke="#cccccc" strokeWidth="3.5" strokeLinecap="round" opacity="0.8"/>
      <path d="M 125,163 L 125,98 A 18,18 0 0,1 143,80 L 257,80 A 18,18 0 0,1 275,98 L 275,163"
            fill="none" stroke="#dd1020" strokeWidth="15" strokeLinecap="round"/>
      <path d="M 125,163 L 125,98 A 18,18 0 0,1 143,80 L 257,80 A 18,18 0 0,1 275,98 L 275,163"
            fill="none" stroke="#ff3344" strokeWidth="7" strokeLinecap="round" opacity="0.55"/>
      <text x="178" y="189" fontSize="16" fill="#d4a843" textAnchor="middle">★</text>
      <text x="200" y="189" fontSize="16" fill="#d4a843" textAnchor="middle">★</text>
      <text x="222" y="189" fontSize="16" fill="#d4a843" textAnchor="middle">★</text>
      <path d="M92 198 L308 198 L308 246 L92 246 Z" fill="#e8132a"/>
      <text x="200" y="238" fontFamily="Arial Black, Arial, sans-serif"
            fontWeight="900" fontSize="48" textAnchor="middle" fill="#ffffff" letterSpacing="5">HHP</text>
      <path id="ta" d="M 55,200 A 145,145 0 0,1 345,200" fill="none"/>
      <text fontFamily="Arial, sans-serif" fontWeight="700" fontSize="17" fill="#d4a843" letterSpacing="2.5">
        <textPath href="#ta" startOffset="50%" textAnchor="middle">HICKS HOCKEY POOL</textPath>
      </text>
    </svg>
  )
}