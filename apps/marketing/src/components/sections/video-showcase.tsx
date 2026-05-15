'use client';

import { useState } from 'react';

import { Play } from 'lucide-react';

import Noise from '@/components/elements/noise';

export default function VideoShowcase() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    // You can add video play logic here
  };

  return (
    <section className="section-padding relative">
      <Noise />
      <div className="bigger-container">
        <span className="text-muted-foreground mb-4 text-sm font-semibold tracking-wide uppercase">
          ABOUT STUWIZ
        </span>
        <div className="flex flex-col justify-between gap-4 md:flex-row xl:gap-8">
          <h2 className="max-w-2xl text-4xl leading-none font-medium tracking-tight lg:text-5xl">
            Built for the messy middle of running a creative studio
          </h2>
          <p className="max-w-lg">
            Stuwiz is for the work that happens after a client says yes:
            schedules, crew, payment milestones, deliverables, reminders,
            approvals, and the daily coordination that keeps a studio moving.
          </p>
        </div>
        {/* Video Section */}
        <div className="mt-8 lg:mt-12">
          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-xl border">
            {!isPlaying ? (
              <>
                {/* Video Thumbnail/Background */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage:
                      'url(https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&h=900&fit=crop&crop=center)',
                  }}
                >
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/30" />
                </div>

                {/* Custom Play Button */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <button
                    onClick={handlePlay}
                    className="group flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-white shadow-lg transition-all duration-300 hover:scale-103 hover:shadow-xl lg:h-24 lg:w-24"
                    aria-label="Play Video"
                  >
                    <Play className="ml-1 size-6 fill-black text-black lg:size-7" />
                  </button>
                  <span className="font-medium text-white">Play Video</span>
                </div>
              </>
            ) : (
              /* Video Player - Replace with your actual video */
              <video
                className="h-full w-full object-cover"
                controls
                autoPlay
                poster="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop&crop=center"
              >
                <source
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* Description */}
          <p className="text-muted-foreground mx-auto mt-4 text-center md:mt-8 md:text-lg">
            It&apos;s built to support clear ownership, fewer missed follow-ups,
            and better visibility across every active booking.
          </p>
        </div>
      </div>
    </section>
  );
}
