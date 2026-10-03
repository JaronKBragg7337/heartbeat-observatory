import sys,glob
from PIL import Image
# usage: sheet.py out.png cols scale files...
out,cols,scale=sys.argv[1],int(sys.argv[2]),float(sys.argv[3]);files=sys.argv[4:]
ims=[Image.open(f).convert('RGB') for f in files]
w,h=int(ims[0].width*scale),int(ims[0].height*scale)
rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*w,rows*h),(0,0,0))
for i,im in enumerate(ims):S.paste(im.resize((w,h)),((i%cols)*w,(i//cols)*h))
S.save(out)
