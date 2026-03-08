import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { type, data, name } = await req.json();
    const usrDataDir = path.join(process.cwd(), 'usr_data');
    
    if (!fs.existsSync(usrDataDir)) {
      fs.mkdirSync(usrDataDir);
    }

    if (type === 'profile') {
      const filePath = path.join(usrDataDir, 'user_profile.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return NextResponse.json({ success: true });
    }

    if (type === 'conversation') {
      const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      const filePath = path.join(usrDataDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const usrDataDir = path.join(process.cwd(), 'usr_data');

    if (type === 'profile') {
      const filePath = path.join(usrDataDir, 'user_profile.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return NextResponse.json(JSON.parse(data));
      }
      return NextResponse.json(null);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
