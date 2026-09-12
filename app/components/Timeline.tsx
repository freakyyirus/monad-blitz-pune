"use client";

import { motion, type Variants } from "framer-motion";
import { Code, CheckCircle2, Cpu, Coins } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Post a Bounty",
    description:
      "Describe the task, set a prize in MON, and settle a 0.001 MON x402 fee. The server verifies the payment on Monad before your bounty goes live on the registry.",
    icon: Code,
  },
  {
    number: "02",
    title: "Hunters Submit",
    description:
      "Developers claim the task and submit markdown write-ups with screenshots attached — previewed live before they hit the registry.",
    icon: CheckCircle2,
  },
  {
    number: "03",
    title: "AI Audit",
    description:
      "Hit one button and Gemini 2.5 Flash streams a ranked top-3 with crisp feedback per submission, weighing the screenshots too.",
    icon: Cpu,
  },
  {
    number: "04",
    title: "Instant Settlement",
    description:
      "Approve the winner and the UI sends the payout. The server verifies recipient + amount on-chain, then flips the bounty to PAID.",
    icon: Coins,
  },
];

const lineItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: custom * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Timeline() {
  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-accent/5 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-14 text-center md:mb-20">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            The Flow
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl md:text-5xl">
            From spec to cheque in{" "}
            <span className="text-gradient">four steps</span>.
          </h2>
        </div>

        <div className="relative">
          {/* Vertical rail — left on mobile, center on md+ */}
          <div className="absolute bottom-2 left-[19px] top-2 w-px bg-gradient-to-b from-accent/0 via-line-strong to-accent/0 md:left-1/2 md:-translate-x-1/2" />

          <div className="flex flex-col gap-10 md:gap-16">
            {steps.map((step, index) => {
              const leftSide = index % 2 === 0;
              return (
                <motion.div
                  key={step.number}
                  custom={index}
                  variants={lineItem}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-90px" }}
                  className={`relative flex items-start gap-6 pl-12 md:gap-0 md:pl-0 ${
                    leftSide ? "" : ""
                  }`}
                >
                  {/* Node */}
                  <div
                    className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-bg-elevated shadow-[0_0_18px_rgba(22,163,74,0.25)] md:left-1/2 md:-translate-x-1/2`}
                  >
                    <step.icon className="h-5 w-5 text-accent" />
                  </div>

                  {/* Card — right side always on mobile; alternate on md+ */}
                  <div
                    className={`w-full md:w-[calc(50%-3rem)] ${
                      leftSide ? "md:mr-auto md:text-right" : "md:ml-auto"
                    }`}
                  >
                    <div className="glass rounded-[12px] border border-line p-5 transition-colors duration-300 hover:border-accent/40 md:p-6">
                      <span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                        Step {step.number}
                      </span>
                      <h3 className="mb-2 text-lg font-bold tracking-tight text-fg md:text-xl">
                        {step.title}
                      </h3>
                      <p className="text-sm font-medium leading-relaxed text-fg-muted">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}