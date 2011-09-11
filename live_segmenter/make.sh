
echo "Compiling..."

gcc -Wall -g live_segmenter/live_segmenter.c -o live_segmenter/live_segmenter -lavformat -lavcodec -lavutil -lbz2 -lm -lz -lfaac -lmp3lame -lx264 -lfaad -lpthread

echo "Done."
