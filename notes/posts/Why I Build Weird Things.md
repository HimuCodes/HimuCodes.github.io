---
title: "Why I Build Weird Things (and Why Building Stuff You Find Cool Matters)"
date: "2025-08-31"
slug: "why-i-build-weird-things"
---



I've always had a soft spot for the useless, the oddly specific, and the "no one asked for this but I did it anyway" kind of projects. If you looked at my desk right now, you'd see a scatter of microcontrollers, a plethora of random stuff like VCR, DVD, Chospticks, Music Box, you get the gist[^1], and probably a half-finished music experiment running on my laptop, spitting out sounds that only make sense to me.

I once glass-painted an Avicii plaque and posted it online — it hit the top of r/EDM, which made me laugh because it wasn't even my "best" work, just the thing I cared about in that moment[^2]. I'm writing a Lua interpreter in Rust just because I thought _stackless execution feels kind of mystical_ (spoiler: it's just weird, and that's enough). I've hoarded datasets like they were precious stones, collected Wi-Fi handshakes at 3 a.m., and sat listening to granular synth textures that sounded like stars collapsing into themselves.[^3]

None of this is neat. None of this is "efficient." And yet, this is how I make sense of the world: by building weird things.

---

## The Catalogue of Strange

Some of the things I've built sound like they belong in different universes entirely:

- **LoRaPwn**: I spent part of my summer in Avignon, France rewriting the LoRaWAN MAC layer from scratch, swapping out AES for ChaCha20-Poly1305, and slipping CNNs into radio spectrograms. Imagine explaining that to someone over coffee — _"yeah, I'm teaching radios to notice when they're being lied to."_[^3b]

- **F.L.A.M.E Nirvanagni**: A fire suppression system that wasn't happy with just _detecting_ flames — it wanted to fight them, with motors that swivel diagonally like a mecha from an anime[^4].

- **Slipper Zero**: A Wi-Fi pentesting tool on ESP32 that made its way into an IEEE publication[^5]. Half the fun wasn't the attacks, but the dance of packets, like watching invisible signals turn into something you could _touch_.

- **Auralis**: A CLI app that composes music with math — chord progressions unfolding from cellular automata, rhythms spiraling out of Wolfram tones. It feels like I tricked Rust into humming to itself.


On paper, these things have nothing in common. But the hidden glue is simple: **I thought they were cool**. That was enough to spend late nights with packet dumps and sound waves, to rewrite code that probably didn't _need_ to be rewritten, to build things that may never have a "market."

---

## Why Cool Matters

See, we spend so much of our lives trying to prove things: proving we can code, proving we can get a job, proving we can be "useful." But "cool-to-you" projects are different. They don't ask for proof. They invite play.

When I chase something I find cool:

- I learn faster, because curiosity is caffeine[^6].

- I connect dots no one else sees - like how music theory bleeds into algorithms, or how debugging feels a lot like writing poetry.

- I build without the weight of expectation. The world says "this better scale" and I say "nah, this better _sing_."

> "You escape competition through authenticity." — Naval Ravikant  
> Building what only I would build means there's no race—just a path only I can walk.
>
> "Not wanting something is as good as having it." — Naval Ravikant  
> Letting go of external scoreboards is what makes late-night tinkering feel like wealth already earned.
>
> "The journey is the only thing there is; even success fades quickly." — Naval Ravikant  
> Shipping, learning, breaking, rewriting—that loop is the reward. The artifact is just a snapshot.

And sometimes the cool-to-you projects _do_ scale, or surprise you, or even get published. But that's never the point. The point is the spark.

---

## The Philosophy of My Weird

To me, hacking isn't about breaking in. It's about listening closely. Systems - whether they're radios, poems, or synthesizers - have seams. Weird projects are how I tug at those seams until they reveal their secret shapes.

My thruline is this:

> **Constraining systems + generous creativity → expressive, dependable work.**

That's why I love embedded systems as much as I love poetry. Both give you boundaries - memory limits, syllable counts, harsh edges. But within those constraints, you can be wildly generous. You can turn blinking LEDs into constellations, packet dumps into choreography, a CLI app into a song.

---

## Why You Should Build Weird Things Too

Because weirdness is underrated. Weirdness is how we remember that engineering is an art, not just a career path.

That half-baked idea you're embarrassed to admit? Build it. That thing you think is "too small" or "too silly"? Build it. Collect the signals, paint the plaque, write the script, code the bot that only makes you laugh.

The first system I hacked wasn't glamorous - just some messy microcontroller code that barely worked.[^7] My first song wasn't polished. My projects don't always make sense in a portfolio. But they're mine, and they form a constellation that tells a story no one else could write.

So here's my advice: build the thing. Build the thing no one asked for. Build the thing that makes you grin at 2 a.m. when the world is quiet and it's just you, your tools, and your weird little universe.

Because that's where the real magic lives.

> Every weird thing I build is a seed I plant in the dark.  
> Some sprout into tools, some into songs, some into nothing at all.  
> But even in their stillness, they remind me:  
> curiosity itself is worth growing.

---

[^1]: I have shitty cable management of networks and power cords, and a drawer full of random electronics parts. My workspace is a controlled chaos that somehow fuels my creativity rather than stifling it.

[^2]: Sometimes the things that resonate most aren't the ones you spent months perfecting, but the ones you made with genuine care in the moment. Here's what **authentic creation** looks like vs. trying to optimize for metrics.

[^3]: Go listen to Aphex Twin's "Xtal" or "Ageispolis" and you'll get what I mean. It's like the sound of a universe folding in on itself.

[^3b]: This was part of my research fellowship at Université d'Avignon. The idea was to use machine learning to detect anomalies in LoRaWAN network traffic that could indicate security attacks.

[^4]: Niravangni was a project I worked on with a team to create an autonomous fire detection and suppression system. The motors were designed to give it a dynamic range of motion, allowing it to target flames from various angles. It was at Pravideon.com I was head of Embedded Systems there.

[^5]: Published in IEEE Xplore at GCWOT 2024. DOI: https://doi.org/10.1109/GCWOT63882.2024.10805625

[^6]: There's actual science behind this - curiosity triggers **dopamine release**, which enhances learning and memory formation. Cool projects literally make your brain work better. It's like *hacking your own neural reward system*.

[^7]: My first embedded project was a simple LED blink program on an Arduino. I coded it on my friends laptop because I didn't have my own yet. But it was fascinating.
