import {OpeningFilingsPage} from "@/features/engineering/OpeningFilingsPage";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{task?:string}>}) {
 const [{id},{task}]=await Promise.all([params,searchParams]);
 return <OpeningFilingsPage projectId={id} taskId={typeof task==="string"?task:undefined}/>;
}
