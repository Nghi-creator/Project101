# Start Ubuntu Linux computer
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Download and Install the Core Tools
RUN apt-get update && apt-get install -y \
    software-properties-common \
    wget \
    xvfb \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-plugins-good

# Download RetroArch
RUN add-apt-repository ppa:libretro/stable && \
    apt-get update && \
    apt-get install -y retroarch

# Create a folder for games
RUN mkdir /roms

CMD ["bash"]