export interface Speaker {
  name: string;
  title: string;
  image: string;
  twitter?: string;
  website?: string;
  imagePosition?: string; // For custom object positioning
  expertise?: string[]; // Areas of expertise
  company?: string; // Company name for easier filtering
}

export const SpeakersList: Speaker[] = [
  {
    name: "Hon. Mobolaji Ogunlende Abubakre",
    title: "Commissioner for Youth & Social Development, LASG",
    image: "/images/speakers/mobolaji.jpg",
    expertise: ["Government & Policy"],
    company: "Lagos State Government",
  },
  {
    name: "Ayodeji Israel Awosika",
    title: "Founder Web3bridge ",
    image: "/images/speakers/ayodeji.jpg",
    twitter: "https://x.com/ebunayo08?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://www.web3bridgeafrica.com/",
    expertise: ["Blockchain & Web3", "Education"],
    company: "Web3bridge",
  },
  {
    name: "Mrs. Chisom Edwin",
    title: "Founder Peaches Academy/Nestrolab",
    image: "/images/speakers/chisom.jpg",
    expertise: ["Education"],
    company: "Nestrolab",
  },
  {
    name: "Jeremiah Mayowa",
    title: "Founder and CEO, Jeroid",
    image: "/images/speakers/Jeroidceo.jpg",
    twitter: "https://x.com/belikejeroid?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://jeroid.co/",
    expertise: ["Entrepreneurship"],
    company: "Jeroid",
  },

  {
    name: "Daniel Ejike Muonuagha",
    title: "Founder, Moon Republic Academy",
    image: "/images/speakers/ejike.WEBP",
    expertise: ["Blockchain & Web3", "Education"],
    company: "Moon Republic Academy",
    twitter: "https://x.com/ajebodanny?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },
  {
    name: "Balogun Sofiyullah",
    title: "Lawyer/Managing Partner, Lightfield LP",
    image: "/images/speakers/balogun.jpg",
    expertise: ["Legal & Regulation"],
    company: "Lightfield LP",
  },
  {
    name: "Idris Olubisi",
    title: "Developer Relations Engineer & Founder, Web3 Afrika",
    image: "/images/speakers/idris.jpg",
    expertise: [
      "Blockchain & Web3",
      "Education",
      "Developer Relations",
      "Developer",
    ],
    company: "Web3 Afrika",
    twitter: "https://x.com/olanetsoft",
    website: "https://www.web3afrika.com/",
  },
  {
    name: "Kyrian Alex",
    title: "Research Analyst, Cointelegraph Research",
    image: "/images/speakers/alex.jpg",
    expertise: ["Research & Analysis"],
    company: "Cointelegraph",
    twitter: "https://x.com/0xsese?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://substack.com/@kyrianalex",
  },
  // {
  //   name: "Chidubem Emelumadu",
  //   title: "Ecosystem Lead(Africa), Lisk",
  //   image: "/images/speakers/chidubem.jpg"
  // }

  {
    name: "Sir. K.C. Onyekachi",
    title: "Founder, Opex School of Excellence",
    image: "/images/speakers/onyekachi.jpg",
    expertise: ["Education", "Entrepreneurship"],
    company: "Opex School of Excellence",
    twitter: "https://x.com/kceeonyekachi1?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },
  {
    name: "Sarah Idahosa",
    title: "Founder, Women In DeFi",
    image: "/images/speakers/sarah.jpg",
    expertise: ["Education", "Blockchain & Web3", "DeFi"],
    company: "Women In DeFi",
  },
  {
    name: "Elisha Owusu Akyaw ",
    title: "Senior Social Media Manager, OG Labs",
    image: "/images/speakers/elisha.jpg",
    expertise: ["Marketing & Media"],
    company: "0G Labs",
    twitter: "https://x.com/GhCryptoGuy",
    website: "https://elisha-owusu-akyaw.com",
  },
  {
    name: "TheGreatOla",
    title: "Web3 Marketer & Vibe Creator",
    image: "/images/speakers/ola.jpg",
    expertise: ["Education", "Blockchain & Web3"],
    twitter: "https://x.com/thegreatola?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://linktr.ee/thegreatola",
  },

  {
    name: "Adum Obinna Abraham",
    title: "Founder DTCSI ACADEMY, TECHNOVA",
    image: "/images/speakers/obinna.jpg",
    expertise: ["Education"],
    company: "DTCSI ACADEMY",
    twitter: "https://x.com/thenameisbrill?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },

  {
    name: "Tochukwu Okoro",
    title: "Founder and CEO UseAzza",
    image: "/images/speakers/okoro.jpg",
    expertise: ["Education", "Entrepreneurship"],
    company: "UseAzza",
  },

  {
    name: "Chike Okonkwo",
    title: "Business Development, Marketing & Operations",
    image: "/images/speakers/chike.jpg",
    expertise: ["Business", "Marketing"],
  },
  {
    name: "Onone Peace Ega",
    title: "Program Manager | FinTech & Web3 Innovation",
    image: "/images/speakers/peace.jpg",
    expertise: ["Education", "Blockchain & Web3", "Fintech"],
    company: "FinTech & Web3 Innovation",
  },
  {
    name: "Gilchrist Emeremgini",
    title: "Co-founder & CEO, Tiva Finance",
    image: "/images/speakers/gilchrist.jpg",
    expertise: ["Education", "Finance"],
    company: "Tiva Finance",
  },
  {
    name: "Faith Mona Alumona",
    title: "Business Development and Partnership, Tiva Finance",
    image: "/images/speakers/faith.jpg",
    expertise: ["Education", "Finance", "Business"],
    company: "Tiva Finance",
  },
  {
    name: "Chimezie Chuta",
    title: "Founder Blockchain Nigeria User Group.",
    image: "/images/speakers/chuta.jpg",
    expertise: ["Education", "Blockchain & Web3"],
    company: "Blockchain Nigeria User Group.",
    twitter: "https://x.com/chimeziechuta?s=21&t=6lhy88Nx16NRD-zFs2-S9w"
  },
  {
    name: "Seun Lanlege",
    title: "Mad scientist Polytope Labs, Co-Founder, Hyperbridge",
    image: "/images/speakers/seun.jpg",
    expertise: ["Education", "Blockchain & Web3"],
    company: "Polytope Labs, Hyperbridge",
    twitter: "https://x.com/seunlanlege?s=21&t=KUUVGbyiHCPiGJm1RzUibA"
  },
];
