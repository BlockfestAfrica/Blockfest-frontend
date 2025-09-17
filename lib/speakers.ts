export interface Speaker {
  name: string;
  title: string;
  image: string;
  twitter?: string;
  website?: string;
}

export const SpeakersList: Speaker[] = [
  {
    name: "Jeremiah Mayowa",
    title: "Founder and CEO, Jeroid",
    image: "/images/speakers/Jeroidceo.jpg",
    twitter: "https://x.com/belikejeroid?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://jeroid.co/"
  },
  {
    name: "Ayodeji Israel Awosika",
    title: "Founder Web3bridge ",
    image: "/images/speakers/ayodeji.jpg",
    twitter: "https://x.com/ebunayo08?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    website: "https://www.web3bridgeafrica.com/"
  },
  {
    name: "Daniel Ejike Muonuagha",
    title: "Founder, Moon Republic Academy",
    image: "/images/speakers/ejike.WEBP",
    
  },
  {
    name: "Balogun Sofiyullah",
    title: "Lawyer/Managing Partner, Lightfield LP",
    image: "/images/speakers/balogun.jpg"
  },
  {
    name: "Kyrian Alex",
    title: "Research Analyst, Cointelegraph Research",
    image: "/images/speakers/alex.jpg"
  },
  {
    name: "Chidubem Emelumadu",
    title: "Ecosystem Lead(Africa), Lisk",
    image: "/images/speakers/chidubem.jpg"
  }
];
