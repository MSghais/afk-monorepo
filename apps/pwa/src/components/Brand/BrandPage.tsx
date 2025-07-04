"use client"
import { useEffect, useState, useMemo } from "react";
import { Icon } from "../small/icon-component";

import Link from "next/link";
import Image from "next/image";

export default function BrandPage({ slug_name }: { slug_name: string }) {

    const [brand, setBrand] = useState<any>(null)

    const [leaderboards, setLeaderboards] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isInitialLoading, setIsInitialLoading] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const [activeTab, setActiveTab] = useState<"leaderboard" | "feed">("leaderboard")

    const [activePlatformLeaderboard, setActivePlatformLeaderboard] = useState<string>("twitter")


    const leaderboard = useMemo(() => {
        return leaderboards.find((leaderboard: any) => leaderboard.platform === activePlatformLeaderboard)
    }, [leaderboards, activePlatformLeaderboard])


    useEffect(() => {
        const fetchBrandBySlugName = async () => {

            console.log("fetchBrand by slug_name", slug_name)
            try {
                setIsLoading(true)
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/brand/view-profile?slug_name=${slug_name}`)
                const data = await res.json()
                setBrand(data?.brand)
                setLeaderboards(data?.leaderboards || [])
                setLoading(false)
                setIsInitialLoading(true)
                setIsLoading(false)
            } catch (error) {
                console.log("error", error)
            } finally {
                setIsLoading(false)
            }

        }
        if (!isInitialLoading) {
            fetchBrandBySlugName()
            setIsInitialLoading(true)
        }
    }, [isInitialLoading])



    if (!slug_name) {
        return <div>No slug</div>
    }

    if (isLoading) {
        return <div>Loading...</div>
    }

    return (
        <div className="w-full flex justify-center items-start px-0 sm:px-2 py-4">
            <div className="w-full sm:max-w-2xl  p-2 sm:p-6 mx-0 sm:mx-auto flex flex-col gap-4">
                {/* <button onClick={() => setIsInitialLoading(false)} className="mb-4"><Icon name="RefreshIcon" size={20} /></button> */}

                {brand && (
                    <div className="flex flex-col items-center gap-4 break-words whitespace-normal w-full">
                        <div className="flex flex-row items-center gap-2 items-baseline w-full justify-center">
                            <h2 className="text-2xl font-bold text-center break-words w-full">{brand?.name} </h2>

                            {<Icon name="CheckIcon" size={20} className="text-green-600" />}
                        </div>
                        {/* <p className="text-gray-500 text-sm">{brand?.slug_name}</p> */}

                        <img src={brand.avatar_url ?? `/assets/icons/${brand.slug_name}.png`} alt={brand.name} className="w-20 h-20 object-cover rounded-full border border-gray-200 shadow-md" />

                        <p className="break-words whitespace-normal text-center w-full px-2 text-gray-800 dark:text-gray-200">{brand?.description}</p>
                        {/* 
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full justify-center items-center">
                            <p className="text-xs text-gray-600 break-all">Starknet: {brand?.starknet_address ? `${brand.starknet_address.slice(0, 6)}...${brand.starknet_address.slice(-4)}` : '-'}</p>
                            <p className="text-xs text-gray-600 break-all">EVM: {brand?.evm_address ? `${brand.evm_address.slice(0, 6)}...${brand.evm_address.slice(-4)}` : '-'}</p>
                        </div> */}

                        <div className="w-full flex justify-center">
                            <div className="flex flex-row gap-2">
                                <Link href={`https://x.com/${brand.twitter_handle}`} target="_blank">
                                    <button 
                                    className="flex flex-row items-center gap-2 px-1 py-1 rounded hover:bg-blue-200 transition "
                                    >
                                        <Image src={`/assets/icons/twitter.svg`} alt="Twitter" width={30} height={30} />
                                        <span className="truncate">Twitter</span>
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-row gap-2 sm:gap-4 w-full justify-center my-4">
                    <button className={`px-4 py-2 rounded-md w-1/2 sm:w-auto ${activeTab === "leaderboard" ? "bg-blue-700 text-white" : "border border-gray-300"}`} onClick={() => setActiveTab("leaderboard")}>Leaderboard</button>
                    <button className={`px-4 py-2 rounded-md w-1/2 sm:w-auto ${activeTab === "feed" ? "bg-blue-700 text-white" : "border border-gray-300"}`} onClick={() => setActiveTab("feed")}>Feeds</button>
                </div>

                <div className="px-0 sm:px-2 w-full">
                    {activeTab === "feed" && (
                        <div className="my-8 w-full">
                            <h2 className="text-xl font-semibold mb-4">Feeds</h2>
                            <p>Feeds is coming soon</p>
                        </div>
                    )}
                    {leaderboards && activeTab === "leaderboard" &&
                        <div className="my-4 w-full">
                            {/* <h2 className="text-xl font-semibold mb-4">Leaderboard</h2> */}

                            <div className="flex flex-row gap-2 sm:gap-4 overflow-x-auto shadow-md rounded-md p-2 mb-4 w-full scrollbar-hide">
                                {leaderboards?.map((leaderboard: any) => (
                                    <div key={leaderboard.id}
                                        className={`rounded-md p-2 max-w-[75px] flex flex-row items-center gap-2 cursor-pointer transition ${activePlatformLeaderboard === leaderboard.platform ? "" : ""}`}
                                        onClick={() => setActivePlatformLeaderboard(leaderboard.platform)}>
                                        <p className="font-medium mb-1 italic">{leaderboard.platform}</p>
                                        <img src={`/assets/icons/${leaderboard.platform}.svg`} alt={leaderboard.platform} className="w-10 h-10 object-cover rounded-full" />
                                    </div>
                                ))}
                            </div>

                            {leaderboard && (
                                <div className="overflow-x-auto scrollbar-hide w-full">
                                    {/* <h3 className="font-semibold mb-2">{leaderboard.platform}</h3> */}
                                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 overflow-x-auto scrollbar-hide" >
                                        {/* <p className="rounded px-2 py-1 text-sm ">Total Score: <span className="font-bold">{leaderboard.total_score}</span></p> */}
                                        <p className="rounded px-2 py-1 text-sm ">Top Users: <span className="font-bold">{leaderboard.total_users}</span></p>
                                        {/* <p className="rounded px-2 py-1 text-sm ">Rank Position: <span className="font-bold">{leaderboard.rank_position}</span></p> */}
                                    </div>
                                    <div className="overflow-x-auto rounded w-full">
                                        <table className="min-w-full w-full text-sm  rounded-lg">
                                            <thead className="sticky top-0 z-10 border-b border-gray-300 dark:border-gray-700">
                                                <tr>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Username</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Handle</th>
                                                    <th className="px-2 sm:px-4 py-2 text-right">Mindshare</th>
                                                    <th className="px-2 sm:px-4 py-2 text-right">Engagement</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leaderboard?.users_scores && leaderboard?.users_scores?.length > 0 && leaderboard?.users_scores?.map((user: any) => {
                                                    return (
                                                        <tr key={user.id} className="border-b hover:bg-gray-200 dark:hover:bg-gray-700">
                                                            <td className="px-2 sm:px-4 py-2 break-words max-w-[120px]">{user?.name}</td>
                                                            <td className="px-2 sm:px-4 py-2 break-all max-w-[120px]">
                                                                {activePlatformLeaderboard === "twitter" && (
                                                                    <Link href={`https://x.com/${user.handle ?? user?.userName ?? user?.username}`} target="_blank" className="text-blue-600 hover:underline truncate inline-block max-w-[100px]">
                                                                        {user.handle ?? user?.userName ?? user?.username}
                                                                    </Link>
                                                                )}
                                                            </td>
                                                            <td className="px-2 sm:px-4 py-2 text-right">{(user.totalMindshareScore / leaderboard.total_mindshare_score * 100).toFixed(2)}%</td>
                                                            <td className="px-2 sm:px-4 py-2 text-right">{(user.totalEngagementScore / leaderboard.total_engagement_score * 100).toFixed(2)}%</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    }
                </div>
            </div>
        </div >
    )
}