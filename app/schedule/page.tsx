import { Agenda } from "@/components/agenda";


export default function Schedule() {
  return (
    <section className="flex flex-col items-center justify-center lg:py-[30px] lg:px-[100px] md:px-[60px] py-8 px-8 sm:px-8">
      <h2 className="font-medium text-3xl sm:text-4xl md:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-2%] sm:tracking-[-3%] lg:tracking-[-5%] my-[20px] sm:my-[25px] lg:my-[80px] text-black text-center">
        Schedule of Activities
      </h2>
      <Agenda />
    </section>
  )
}
