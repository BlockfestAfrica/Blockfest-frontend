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
    bio: "",
  },

  {
    name: "Chimezie Chuta",
    title: "Founder, Blockchain Nigeria User Group",
    image: "/images/speakers/chuta.jpg",
    expertise: ["Education", "Web3 & Blockchain", "Government & Policy"],
    company: "Blockchain Nigeria User Group",
    twitter: "https://x.com/chimeziechuta?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    bio: "Chimezie Chuta is a pioneering figure in Nigeria's blockchain ecosystem and the Founder of Blockchain Nigeria User Group, one of the country's most influential blockchain communities.",
  },

  {
    name: "Emomotimi Agama",
    title: "Director General, Security and Exchange Commission, Nigeria",
    image: "/images/speakers/agama.jpg",
    expertise: ["Government & Policy", "Education"],
    company: "Security and Exchange Commission, Nigeria",
    bio: "",
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
    bio: "Sarah Idahosa is a versatile professional distinguished for her proficiency in Web3 community development, educational initiatives, and decentralized finance research.\n\nShe serves as the esteemed founder of Women In DeFi, a pioneering organization dedicated to empowering women with comprehensive knowledge of blockchain technology and adeptly navigating the Web3 ecosystem utilizing their existing Web2 competencies.\n\nIn addition to her pivotal role at Women In DeFi, Sarah also assumes the position of partnerships manager at MANSA, a stablecoin liquidity provider backed by Tether.\n\nThrough her stewardship, Sarah facilitates seamless connections between individuals and the manifold advantages inherent in the Web3 landscape. Drawing upon a robust background in blockchain education, Sarah is deeply committed to facilitating individuals' transition from Web2 to Web3 paradigms.",
  },

  {
    name: "Ayodeji Israel Awosika",
    title: "Founder, Web3bridge",
    image: "/images/speakers/ayodeji.jpg",
    twitter: "https://x.com/ebunayo08?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://www.web3bridgeafrica.com/",
    expertise: ["Web3 & Blockchain", "Education", "Development"],
    company: "Web3bridge",
    bio: "Ayodeji Israel Awosika is a visionary blockchain educator and the founder of Web3bridge, Africa's leading Web3 development training institution. Through Web3bridge, Ayodeji has been instrumental in training thousands of developers across Africa, bridging the skills gap in blockchain development and empowering the next generation of Web3 builders.\n\nWith a passion for education and community building, Ayodeji has created comprehensive training programs that have produced some of Africa's most skilled blockchain developers. His work through Web3bridge has been recognized across the continent, making significant contributions to the growth of the Web3 ecosystem in Africa.\n\nAyodeji's commitment to democratizing blockchain education has made him a respected figure in the African tech community, and his initiatives continue to drive innovation and adoption of Web3 technologies across the continent.",
  },
  {
    name: "Jeremiah Mayowa",
    title: "Founder and CEO, Jeroid",
    image: "/images/speakers/Jeroidceo.webp",
    twitter: "https://x.com/belikejeroid?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://jeroid.co/",
    expertise: ["Entrepreneurship", "Fintech"],
    company: "Jeroid",
    bio: "",
  },

  {
    name: "Mrs. Chisom Edwin",
    title: "Founder, Peaches Academy/Nestrolab",
    image: "/images/speakers/chisom.jpg",
    expertise: ["Education", "Tech Innovation"],
    company: "Nestrolab",
    twitter: "https://x.com/1CryptoMama",
    bio: "Mrs. Chisom Edwin Ibor-Stanley, popularly known as Cryptomama, is a key figure in Africa's crypto scene.\n\nBorn in Anambra and married to a Crossriverian, Chisom graduated in Medical Laboratory Science from the University of Calabar, where she showed leadership as Student Union vice president. Her role connected her with influential leaders, shaping her future vision.\n\nBeyond academics, she served as Secretary for the Polling Unit Ambassador of Nigeria (Cross River Chapter). She actively supports campaigns against female genital mutilation and initiatives for empowering girls, highlighting her commitment to social change and laying the foundation for her current impactful work.\n\nWith over 5 years in crypto, she excels as a crypto advocate, marketing strategist, and OG Web3 writer. She founded Peaches Academy and is building NESTROLABs, contributing to projects like TON Blockchain, orbiter finance and LabTrade.\n\nHer airdrop strategy expertise has helped thousands earn life changing sums, with her community making over $100,000 a true testament to her skill and dedication.\n\nKnown as \"CRYPTO MAMA,\" she combines humility and warmth, empowering people in emerging markets to harness Web3 opportunities. She inspires new crypto enthusiasts, making complex ideas accessible and ensuring everyone can tap into blockchain's potential.",
  },

  {
    name: "Onone Peace Ega",
    title: "Program Manager | FinTech & Web3 Innovation",
    image: "/images/speakers/peace.jpg",
    expertise: ["Education", "Web3 & Blockchain", "Fintech"],
    company: "FinTech & Web3 Innovation",
    twitter: "https://x.com/Scrum_maestro",
    bio: "",
  },
  {
    name: "Seun Lanlege",
    title: "Mad Scientist, Polytope Labs | Co-Founder, Hyperbridge",
    image: "/images/speakers/seun.jpg",
    expertise: ["Web3 & Blockchain", "Development", "Research & Analysis"],
    company: "Polytope Labs, Hyperbridge",
    twitter: "https://x.com/seunlanlege?s=21&t=KUUVGbyiHCPiGJm1RzUibA",
    bio: "Seun Lanlege is a brilliant blockchain researcher and developer, known as the 'Mad Scientist' at Polytope Labs and Co-Founder of Hyperbridge. With deep expertise in cryptography, consensus mechanisms, and blockchain infrastructure, Seun has been at the forefront of advancing interoperability solutions and cross-chain technologies.\n\nHis work focuses on building the foundational infrastructure that enables seamless communication between different blockchain networks. Through Hyperbridge, Seun is pioneering novel approaches to cross-chain interoperability, helping to solve some of the most complex technical challenges in the blockchain space.\n\nSeun's contributions to the blockchain ecosystem extend beyond his technical work, as he actively shares his knowledge through research publications, technical talks, and mentoring the next generation of blockchain developers and researchers.",
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
    bio: "Faith Mona Alumona is a Business Development and Partnerships Strategist with expertise in community growth, ecosystem building, and strategic alliances across Web3 and fintech. She has led initiatives that onboarded developers, secured global partnerships, and grew engaged communities, while also hosting industry events that spotlight innovation and inclusion.\n\nCurrently, she drives ecosystem growth through partnerships and business development at Tiva Finance, where she focuses on building strategic relationships that bridge traditional finance and Web3 technologies.\n\nMona's work is characterized by her ability to foster meaningful connections between diverse stakeholders in the blockchain ecosystem, making her a valuable asset in driving adoption and growth in the African Web3 space.",
  },
  {
    name: "Balogun Sofiyullah",
    title: "Lawyer/Managing Partner, Lightfield LP",
    image: "/images/speakers/balogun.jpg",
    expertise: ["Legal & Regulation"],
    company: "Lightfield LP",
    bio: "Balogun Sofiyullahi is a Lawyer and the Managing Partner of Lightfield LP, a Corporate and Technology Law Firm with a strong focus on blockchain and digital assets legal compliance. He has advised companies, start-ups, high-growth ventures, and individuals across diverse sectors, providing guidance on regulatory compliance, business structuring, and the legal frameworks governing emerging technologies.\n\nIn his professional practice, Balogun has worked closely with leading Web3 founders, investors, and innovators, ensuring that their businesses are structured in line with Nigerian law while aligning with international best practices in the rapidly evolving digital economy. His portfolio spans cryptocurrency exchange compliance, token issuance, smart contracts, property transactions, and fintech regulation, as well as traditional corporate advisory on governance, contracts, and intellectual property rights; all enhanced by a deep understanding of evolving technological practices.\n\nDriven by a strong passion for legal research and the judicial process, Balogun has also served as a Legal Assistant to Judges of Superior Courts across Nigeria, including the Supreme Court.\n\nBefore founding Lightfield LP, he worked as a Partner with TAAG Attorneys, Mavin & Gritstone LP, Innsbridge Attorneys, and BRM Legal Practitioners.",
  },

  {
    name: "Kyrian Alex",
    title: "Research Analyst, Cointelegraph Research",
    image: "/images/speakers/alex.jpg",
    expertise: ["Research & Analysis", "Web3 & Blockchain"],
    company: "Cointelegraph",
    twitter: "https://x.com/0xsese?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://substack.com/@kyrianalex",
    bio: "Kyrian Alex is a research analyst with over 6 years of experience in academic cryptography research. He has worked with some top crypto protocols but is currently working at Cointelegraph Research as a specialist in core DeFi infrastructure and products.\n\nKyrian has a background in Mechatronics and control systems engineering. This background has helped him author numerous research reports, some of which have been referenced in top blockchain academic research and have been used to make policies for government parastatals in Eastern europe.\n\nIn capacity as a research analyst at Cointelegraph, he is currently collaborating with BitcoinIRA and the IRS to help define the role of Bitcoin in SDIRAs as a macroeconomic hedge for retirement savings accounts. He is also currently leading an academic research that outlays the emperical scope of covenants as a tool to add more expressiveness to Bitcoin Script.\n\nKyrian is passionate about the transformative potential of blockchain in reshaping global finance and is a huge contributor to open-source research that helps define systematic approaches to emerging blockchain technologies.",
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
    bio: "Sir. K.C Onyekachi (popularly known as Sir Khaycee) is a leading pioneer of the Web3 Jobs and business industry, revolutionizing the space by showing that Web3 extends beyond trading and investment to include lucrative service-based opportunities.\n\nAs the Chief Executive Director @rebirthodyssey and Founder @OpexInstitute, he has guided over 20,000 people to become profitable Web3 operators, helping them raise over $2M by building sustainable income systems and personal brands.\n\nA full-time entrepreneur and educator, his academy is a launchpad for financial transformation.",
  },

  {
    name: "Elisha Owusu Akyaw ",
    title: "Senior Social Media Manager, 0G Labs",
    image: "/images/speakers/elisha.jpg",
    expertise: ["Marketing & Media", "Web3 & Blockchain"],
    company: "0G Labs",
    twitter: "https://x.com/GhCryptoGuy",
    website: "https://elisha-owusu-akyaw.com",
    bio: 'Elisha Owusu Akyaw (GhCryptoGuy) is a seasoned cryptocurrency marketer and educator with a passion for shaping the future of decentralized technology. Currently the Senior Social Media Manager at 0G Labs, Elisha previously managed Cointelegraph\'s social presence and hosted the "Hashing It Out" podcast. Before joining Cointelegraph, he served as the Business Development Manager for Binance in Ghana.\n\nElisha began his crypto journey at just 16 years old and brings a wealth of experience from multiple roles across the Web3 marketing landscape, with a strong commitment to education and community building in Ghana and beyond. Known for his thought leadership, he is dedicated to making complex blockchain concepts accessible and inspiring others to explore the transformative potential of crypto.',
  },
  {
    name: "Ugochukwu Aronu",
    title: "Co-Founder Xend Finance, Wicrypt and AssetChain",
    image: "/images/speakers/aronu.webp",
    expertise: ["Business & Finance", "Entrepreneurship", "Web3 & Blockchain"],
    company: "Xend Finance, Wicrypt and AssetChain",
    twitter: "https://x.com/AronuUgochukwu",
    bio: "Co-Founder Xend Finance, Wicrypt and AssetChain. First Principles engineer. 9+ years building in crypto space.\n\nUgochukwu Aronu is a serial entrepreneur and first-principles engineer with over 9 years of experience building innovative solutions in the cryptocurrency and blockchain space. As co-founder of multiple successful ventures including Xend Finance, Wicrypt, and AssetChain, he has demonstrated exceptional ability to identify market gaps and build sustainable solutions.\n\nHis work spans across DeFi protocols, wireless infrastructure, and blockchain networks, showcasing his versatility and deep technical understanding of distributed systems. Ugochukwu's approach to problem-solving from first principles has enabled him to create groundbreaking products that address real-world challenges in emerging markets.",
  },

  {
    name: "TheGreatOla",
    title: "Web3 Marketer & Vibe Creator",
    image: "/images/speakers/ola.jpg",
    expertise: ["Marketing & Media", "Web3 & Blockchain"],
    twitter: "https://x.com/thegreatola?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://linktr.ee/thegreatola",
    bio: "",
  },
  {
    name: "Harri Obi",
    title: "Lead, Solana SuperteamNG",
    image: "/images/speakers/obi.webp",
    expertise: ["Education", "Web3 & Blockchain"],
    company: "SuperteamNG",
    twitter: "https://x.com/Harri_obi",
    bio: "Harrison Obiefule began his career working on global brands like Pepsi and Meta (formerly Facebook) before transitioning to the Blockchain technology industry in 2021.\n\nSince then, he has led continent-wide growth, marketing, and communications efforts for international cryptocurrency companies, including FTX Africa and Bitget Africa, both of which were among the top 5 cryptocurrency exchanges by global trading volume during his tenure, as well as Cassava Network, which raised $9 million.\n\nCurrently, Harrison co-leads the Nigerian arm of Superteam, a global community of software developers, creatives, and designers collaborating on innovative projects on the Solana Blockchain across 20+ countries.\n\nIn addition to his role, Harrison provides consulting services to local and international blockchain companies, offering expertise in marketing and growth strategies, as well as African expansion, and is the founder of the Harri Obi Foundation, a non-profit organisation dedicated to accelerating blockchain adoption in Africa through education, cultural engagement, and government advocacy.\n\nHe is currently pursuing a Doctorate in Business Administration with a specialisation in Marketing and Media Management at Rome Business School.",
  },
  {
    name: "Chike Okonkwo",
    title: "Business Development, Marketing & Operations",
    image: "/images/speakers/chike.jpg",
    expertise: ["Business & Finance", "Marketing & Media"],
    twitter: "https://x.com/Okonkwochike",
    bio: "",
  },
  {
    name: "Adum Obinna Abraham",
    title: "Founder, DTCSI ACADEMY & TECHNOVA",
    image: "/images/speakers/obinna.jpg",
    expertise: ["Education", "Tech Innovation"],
    company: "DTCSI ACADEMY",
    twitter: "https://x.com/thenameisbrill?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    bio: 'Adum Obinna (Brill) is an entrepreneur, educator, and social innovator driving Africa\'s digital and human capital revolution. As Founder & CEO of DTCSI Academy, he has mentored 10,000+ students globally in Web3, design, and digital entrepreneurship, while his Greencal Foundation advances health, education, and social welfare in underserved communities.\n\nKnown across the ecosystem as "The Beekeeper" guiding the HIVE, Brill is shaping the future of work, leadership, and economic inclusion in Africa and beyond. His mantra: "There\'s always honey in the HIVE."\n\nThrough his various initiatives, Brill has created comprehensive training programs that empower young Africans with the skills needed to thrive in the digital economy, making him a respected figure in the African tech and education space.',
  },

  {
    name: "Tochukwu Okoro",
    title: "Founder and CEO, Azza",
    image: "/images/speakers/okoro.jpg",
    expertise: ["DeFi", "Entrepreneurship"],
    company: "Azza",
    twitter: "https://x.com/ToochukwuOkoro2",
    bio: "",
  },
  {
    name: "Gilchrist Emeremgini",
    title: "Co-founder & CEO, Tiva Finance",
    image: "/images/speakers/gilchrist.jpg",
    expertise: ["Business & Finance", "Entrepreneurship", "Fintech"],
    company: "Tiva Finance",
    bio: "Gilchrist Emeremgini is a Nigerian fintech entrepreneur and technologist who founded Tiva Finance, a fintech solution that bridges the gap between web3 and traditional finance systems.\n\nBefore Tiva, Gilchrist built the market-leading business intelligence and corporate strategy unit at C. Woermann, and founded DeliveryGuy Africa, a last-mile logistics infrastructure-as-a-service. He now also drives group-wide process optimisation at Union Maritime, bringing data-driven discipline to a pan-African maritime logistics network.\n\nHe has spent his career championing digital transformation, strategy, and operational efficiency across Nigeria's industrial sectors. He has previously led cross-functional tech teams and built software tools that generate millions in revenue.",
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
    bio: "Some people bridge tokens, some people bridge gaps. Oreoluwa Zebulun Ajayi bridges the gap between marketing, event curation, and all things creative in web3.\n\nAs a Web3 Creative Director, over the last 4 years, she's been shaping the spaces where culture, creativity, and community collide.\n\nCurrently leading creative strategy and content for Web3 communities, events and projects like Nirvana Academy and BLOCKFEST AFRICA.\n\nZebulun is passionate about offering a better outlook to all things that involve selling an idea, event or product in Web3; whether it's launching branded experiences, directing visual campaigns, or designing educational content for crypto communities and brands, Zebulun's work is rooted in helping Africans show up, skill up, and stand out in the future of the crypto market and Web3 creatives landscape.",
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
    twitter: "https://x.com/Blazebrain01",
    linkedin: "https://linkedin.com/in/david-adegoke",
    website: "https://www.blazebrain.me",
    bio: "David Adegoke is a skilled Mobile Engineer at Cake Wallet, where he contributes to building user-friendly mobile applications for cryptocurrency and blockchain interactions. With expertise in mobile development and Web3 technologies, David has been instrumental in creating accessible mobile solutions that make blockchain technology more approachable for everyday users.\n\nAs an educator and developer advocate, David actively shares his knowledge through various channels, helping to bridge the gap between complex blockchain concepts and practical mobile applications. His work focuses on creating intuitive user experiences that enable seamless interaction with cryptocurrency wallets and DeFi protocols.\n\nDavid's contributions to the mobile development and Web3 space have made him a respected figure in the African tech community, where he continues to inspire and educate the next generation of mobile developers and blockchain enthusiasts.",
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
