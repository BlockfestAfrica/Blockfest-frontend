export interface Speaker {
  name: string;
  title: string;
  image: string;
  twitter?: string;
  website?: string;
  linkedin?: string; // LinkedIn profile URL
  youtube?: string; // YouTube channel URL
  imagePosition?: string; // For custom object positioning
  expertise?: string[]; // Areas of expertise
  company?: string; // Company name for easier filtering
  bio?: string; // Speaker biography with markdown support
}

export const SpeakersList: Speaker[] = [
  {
    name: "Samuel Olaoyenikan",
    title: "Convener BlockF3st Africa & Founder, Nirvana Academy",
    image: "/images/speakers/samuelo.jpg",
    expertise: ["Education", "Web3 & Blockchain"],
    company: "BlockF3st Africa & Nirvana Academy",
    twitter: "https://x.com/SamuelXeus",
    bio: "Often caught introducing himself as Wealth as vast as the Ocean, Samuel Oladokun Olaoyenikan alias XeusTheGreat, is best known as the Blockchain Connoisseur.\n\nSamuel is the seasoned visionary founder of NIRVANA Academy and Labs- Africa's foremost Web3 training institution.\n\nOver the last 5 years, through 12 impactful cohorts, NIRVANA Academy has directly trained over 20,000 students globally, with its ripple effect extending to countless others in the Web3 space.\n\nHis personal mantra, \"To know is to be free,\" has become a movement- inspiring a new generation of thinkers, builders, and believers in blockchain technology.\n\nBehind The Scenes, Samuel has and still plays a strategic role as marketing lead and project advisory for an impressive number of crypto projects that have launched successfully across the Web3 ecosystem. You just might be using one right now.\n\nBeyond tech, Samuel doesn't take a backseat in philanthropic efforts. Through his initiative, TEVAH Foundation, he has touched and transformed countless lives, staying true to his mission of using knowledge and technology as tools for empowerment.",
  },
  {
    name: "Hon. Mobolaji Ogunlende Abubakre",
    title: "Commissioner for Youth & Social Development, LASG",
    image: "/images/speakers/mobolaji.jpg",
    expertise: ["Government & Policy"],
    company: "Lagos State Government",
    twitter: "https://x.com/mo_ogunlende?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },

  {
    name: "Chimezie Chuta",
    title: "Founder, Blockchain Nigeria User Group",
    image: "/images/speakers/chuta.jpg",
    expertise: ["Education", "Web3 & Blockchain", "Government & Policy"],
    company: "Blockchain Nigeria User Group",
    twitter: "https://x.com/chimeziechuta?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },

  {
    name: "Emomotimi Agama",
    title: "Director General, Security and Exchange Commission, Nigeria",
    image: "/images/speakers/agama.jpg",
    expertise: ["Government & Policy", "Education"],
    company: "Security and Exchange Commission, Nigeria",
  },

  {
    name: "Idris Olubisi",
    title: "Developer Relations Engineer & Founder, Web3 Afrika",
    image: "/images/speakers/idris2.jpg",
    expertise: ["Web3 & Blockchain", "Education", "Development"],
    company: "Web3 Afrika",
    twitter: "https://x.com/olanetsoft",
    website: "https://web3afrika.com",
    linkedin: "https://www.linkedin.com/in/idris-olubisi/",
    bio: "As a Developer Relations Engineer, Idris combines extensive industry knowledge with a passion for inspiring and empowering fellow developers.\n\nIdris has garnered millions of views with a proven track record of contributing to reputable publications, including FreeCodeCamp, Section Engineering, Logrocket, Media Jams (Cloudinary), AppSmith, ImageKit, Aviyel, Hashnode Web3, Alchemy, Infura, and Moralis. His expertise and thought leadership have made him a highly sought-after developer relations engineer, fostering valuable relationships with key stakeholders, including developers, engineers, and product managers.\n\nIdris actively engages with the developer community through various channels, including meetups, boot camps, hackathons, lectures, online spaces, and training programs. He founded Web3 Afrika, a developer community dedicated to onboarding, supporting, and educating web3 builders. Additionally, he serves as the Backend Lead at SheCodeAfrica, a thriving coding community with over 40,000 active female participants.\n\nHe is recognized for his exceptional ability to aggregate feedback from the developer community, prioritize feature requests, and align internal organizations with the needs of developer partners. He has captivated audiences with his compelling talks, workshops, and live coding demos, both virtually and in person, inspiring and educating fellow professionals.",
  },

  {
    name: "Sarah Idahosa",
    title: "Founder, Women In DeFi",
    image: "/images/speakers/sarah.jpg",
    expertise: ["Web3 & Blockchain", "DeFi", "Community Building", "Education"],
    company: "Women In DeFi",
    twitter: "https://x.com/thesarahidahosa",
    website: "https://womenindefi.org/",
  },

  {
    name: "Ayodeji Israel Awosika",
    title: "Founder, Web3bridge",
    image: "/images/speakers/ayodeji.jpg",
    twitter: "https://x.com/ebunayo08?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://www.web3bridgeafrica.com/",
    expertise: ["Web3 & Blockchain", "Education", "Development"],
    company: "Web3bridge",
  },
  {
    name: "Jeremiah Mayowa",
    title: "Founder and CEO, Jeroid",
    image: "/images/speakers/Jeroidceo.webp",
    twitter: "https://x.com/belikejeroid?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://jeroid.co/",
    expertise: ["Entrepreneurship", "Fintech"],
    company: "Jeroid",
  },

  {
    name: "Mrs. Chisom Edwin",
    title: "Founder, Peaches Academy/Nestrolab",
    image: "/images/speakers/chisom.jpg",
    expertise: ["Education", "Tech Innovation"],
    company: "Nestrolab",
    twitter: "https://x.com/1CryptoMama",
  },

  {
    name: "Onone Peace Ega",
    title: "Program Manager | FinTech & Web3 Innovation",
    image: "/images/speakers/peace.jpg",
    expertise: ["Education", "Web3 & Blockchain", "Fintech"],
    company: "FinTech & Web3 Innovation",
    twitter: "https://x.com/Scrum_maestro",
  },
  {
    name: "Seun Lanlege",
    title: "Mad Scientist, Polytope Labs | Co-Founder, Hyperbridge",
    image: "/images/speakers/seun.jpg",
    expertise: ["Web3 & Blockchain", "Development", "Research & Analysis"],
    company: "Polytope Labs, Hyperbridge",
    twitter: "https://x.com/seunlanlege?s=21&t=KUUVGbyiHCPiGJm1RzUibA",
  },
  {
    name: "Daniel Ejike Muonuagha",
    title: "Founder, Moon Republic Academy",
    image: "/images/speakers/ejike.WEBP",
    expertise: ["Web3 & Blockchain", "Education"],
    company: "Moon Republic Academy",
    twitter: "https://x.com/ajebodanny?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },
  {
    name: "Faith Mona Alumona",
    title: "Business Development and Partnership, Tiva Finance",
    image: "/images/speakers/faith.webp",
    expertise: ["Business & Finance", "Partnerships"],
    company: "Tiva Finance",
  },
  {
    name: "Balogun Sofiyullah",
    title: "Lawyer/Managing Partner, Lightfield LP",
    image: "/images/speakers/balogun.jpg",
    expertise: ["Legal & Regulation"],
    company: "Lightfield LP",
  },

  {
    name: "Kyrian Alex",
    title: "Research Analyst, Cointelegraph Research",
    image: "/images/speakers/alex.jpg",
    expertise: ["Research & Analysis", "Web3 & Blockchain"],
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
    name: "Elisha Owusu Akyaw ",
    title: "Senior Social Media Manager, 0G Labs",
    image: "/images/speakers/elisha.jpg",
    expertise: ["Marketing & Media", "Web3 & Blockchain"],
    company: "0G Labs",
    twitter: "https://x.com/GhCryptoGuy",
    website: "https://elisha-owusu-akyaw.com",
  },
  {
    name: "Ugochukwu Aronu",
    title: "Co-Founder Xend Finance, Wicrypt and AssetChain",
    image: "/images/speakers/aronu.webp",
    expertise: ["Business & Finance", "Entrepreneurship", "Web3 & Blockchain"],
    company: "Xend Finance, Wicrypt and AssetChain",
    twitter: "https://x.com/AronuUgochukwu",
  },

  {
    name: "TheGreatOla",
    title: "Web3 Marketer & Vibe Creator",
    image: "/images/speakers/ola.jpg",
    expertise: ["Marketing & Media", "Web3 & Blockchain"],
    twitter: "https://x.com/thegreatola?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://linktr.ee/thegreatola",
  },
  {
    name: "Harri Obi",
    title: "Lead, Solana SuperteamNG",
    image: "/images/speakers/obi.webp",
    expertise: ["Education", "Web3 & Blockchain"],
    company: "SuperteamNG",
    twitter: "https://x.com/Harri_obi",
  },
  {
    name: "Chike Okonkwo",
    title: "Business Development, Marketing & Operations",
    image: "/images/speakers/chike.jpg",
    expertise: ["Business & Finance", "Marketing & Media"],
    twitter: "https://x.com/Okonkwochike",
  },
  {
    name: "Adum Obinna Abraham",
    title: "Founder, DTCSI ACADEMY & TECHNOVA",
    image: "/images/speakers/obinna.jpg",
    expertise: ["Education", "Tech Innovation"],
    company: "DTCSI ACADEMY",
    twitter: "https://x.com/thenameisbrill?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
  },

  {
    name: "Tochukwu Okoro",
    title: "Founder and CEO, Azza",
    image: "/images/speakers/okoro.jpg",
    expertise: ["DeFi", "Entrepreneurship"],
    company: "Azza",
    twitter: "https://x.com/ToochukwuOkoro2",
  },
  {
    name: "Gilchrist Emeremgini",
    title: "Co-founder & CEO, Tiva Finance",
    image: "/images/speakers/gilchrist.jpg",
    expertise: ["Business & Finance", "Entrepreneurship", "Fintech"],
    company: "Tiva Finance",
  },
  {
    name: "Obinna Iwuno",
    title:
      "Strategy Lead, CBC Blockchain Services | President, SiBAN | Founder, Crypto Bootcamp",
    image: "/images/speakers/obinnaiw.jpg",
    expertise: [
      "Business & Finance",
      "Entrepreneurship",
      "Education",
      "Web3 & Blockchain",
      "Legal & Regulation",
    ],
    company: "CBC Blockchain Services",
    twitter: "https://twitter.com/iwuno_obinna",
    linkedin: "https://www.linkedin.com/in/obinna-iwuno",
    bio: "Obinna Iwuno is a globally recognized blockchain leader, digital economy expert, educator, and web3 pioneer, dedicated to advancing the adoption and integration of blockchain technology across Africa and beyond. As the CEO of CBC Blockchain Services and the President of SiBAN (Stakeholders in Blockchain Technology Association of Nigeria), the largest self-regulatory body in Africa's blockchain ecosystem, Obinna has spearheaded transformative initiatives in blockchain advocacy, education, and policy development.\n\nWith over a decade of experience, Obinna has trained more than 10,000 individuals in blockchain technology and has facilitated the entry of numerous blockchain and Web3 projects into emerging markets. As the founder of four influential blockchain communities for professionals, including Africa's largest blockchain and web3 community, Crypto Bootcamp, he has built platforms that empower professionals, developers, and investors to explore the transformative potential of decentralized technologies.\n\nA policy and regulations expert, Obinna collaborates with governments and institutions across Africa to design and implement blockchain investment strategies, regulatory frameworks, and infrastructure roadmaps. His expertise extends to drafting national blockchain and Bitcoin strategies, positioning him as a trusted advisor on regulatory compliance, digital asset adoption, and market development.\n\nObinna's multidisciplinary background includes roles as a business developer, blockchain investment analyst, cryptocurrency compliance specialist, and investigator. He holds a degree in Management and certifications in cryptocurrency compliance and investigation, equipping him with a unique blend of technical and strategic insights.\n\nAs a visionary advocate for blockchain's transformative power, Obinna is committed to fostering innovation, creating economic opportunities, and advancing digital equity globally. His work continues to drive blockchain adoption and lay the foundation for a sustainable digital economy in Africa and beyond.",
  },
  {
    name: "Zebulun Ajayi ",
    title: "Web3 Creative Director",
    image: "/images/speakers/ajayi.jpg",
    expertise: ["Education", "Web3 & Blockchain"],
  },
  {
    name: "Atinuke Oluwabamikemi Kayode",
    title: "Community Marketing Specialist, AsyncAPI",
    image: "/images/speakers/atinuke.webp",
    expertise: ["Education", "Marketing & Media"],
    company: "AsyncAPI",
    twitter: "https://x.com/oluwabamikemi",
    linkedin:
      "https://www.linkedin.com/in/atinuke-oluwabamikemi-kayode-5b838b1b7",
    youtube: "https://youtube.com/@oluwabamikemikayode-n5f",
    bio: "**Oluwabamikemi Kayode** is a Community Marketing Specialist at AsyncAPI, an open-source initiative building event-driven architectures. With a background in Python development, technical writing, and community management, she has worked with organizations like Tunga and actively contributes to SheCodeAfrica, Layer5, GDG Lagos, CHAOSS, and Web3Afrika.\n\nShe is passionate about empowering young people—especially women—to thrive in tech, and she regularly shares insights on community building, open source, and career growth through her blog and speaking engagements. Bamikemi has spoken at events like API Conference Lagos, OSCAFEST, and the Community Manager Festival.",
  },
  {
    name: "Wisdom Matic",
    title: "Crypto Investor, Trader and Coach",
    image: "/images/speakers/matic.jpg",
    expertise: ["Education", "Web3 & Blockchain"],
  },
  {
    name: "David Adegoke",
    title: "Mobile Engineer, Cake Wallet",
    image: "/images/speakers/adegoke.jpg",
    expertise: ["Education", "Development", "Web3 & Blockchain"],
    company: "Cake Wallet",
  },
];

// Export unique expertise categories for filtering
export const expertiseCategories = [
  "Web3 & Blockchain",
  "Education",
  "Entrepreneurship",
  "Business & Finance",
  "Marketing & Media",
  "Development",
  "DeFi",
  "Legal & Regulation",
  "Government & Policy",
  "Fintech",
  "Tech Innovation",
  "Community Building",
  "Research & Analysis",
  "Partnerships",
] as const;
