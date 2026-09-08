import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function WeightHistoryChart({ weights }) {
  return (
    <div style={{width:"100%",height:180}}>
      <ResponsiveContainer width="100%" height={180}><LineChart data={weights.map(w=>({date:w.log_date.slice(5),weight:w.weight_lbs}))}><CartesianGrid strokeDasharray="3 3" stroke="#DCE8E0"/><XAxis dataKey="date" stroke="#385744" tick={{fontSize:11}}/><YAxis stroke="#385744" tick={{fontSize:11}} domain={["auto","auto"]}/><Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:10,color:"#1A2E22",fontSize:13}} formatter={v=>[v+" lbs","Weight"]}/><Line type="monotone" dataKey="weight" stroke="#2C4A38" strokeWidth={2} dot={{r:3,fill:"#2C4A38"}}/></LineChart></ResponsiveContainer>
    </div>
  );
}
