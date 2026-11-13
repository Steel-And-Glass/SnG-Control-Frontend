import { PreparationPage } from "@/features/operations/PreparationPage";
export default async function Page({params}:{params:Promise<{id:string}>}) { const {id}=await params; return <PreparationPage id={id}/>; }
