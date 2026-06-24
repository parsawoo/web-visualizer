import { Link } from 'react-router-dom';

export default function Topbar({ title }: { title: [string, string] }) {
  return (
    <div className="topbar">
      <Link to="/" className="back-btn">← LOBBY</Link>
      <div className="studio-title">{title[0]} <span className="accent-text">{title[1]}</span></div>
      <div className="fmt-toggle">
        <span className="lbl">Export</span>
        <div className="switch" id="fmtSwitch">
          <button data-fmt="webm">WEBM·빠름</button>
          <button data-fmt="mp4">MP4·호환</button>
        </div>
      </div>
    </div>
  );
}
