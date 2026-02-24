FROM --platform=linux/amd64 ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 1. Download Core Tools
RUN apt-get update && apt-get install -y \
    software-properties-common \
    wget \
    curl \
    unzip \
    xvfb \
    xdotool \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-plugins-good

# 2. Download RetroArch (launchpad PPA)
RUN add-apt-repository -y ppa:libretro/stable && \
    apt-get update && apt-get install -y --no-install-recommends retroarch

# 3. Fetch PC NES Core
RUN mkdir -p /cores && \
    wget -q https://buildbot.libretro.com/nightly/linux/x86_64/latest/nestopia_libretro.so.zip -O /cores/nestopia.zip && \
    cd /cores && unzip nestopia.zip && rm nestopia.zip

# 4. Install Node.js 
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 5. Set up server
WORKDIR /app

RUN npm install express socket.io cors
RUN mkdir -p /roms
COPY app_server/server.js /app/server.js

CMD ["node", "server.js"]