"use client";

import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { init } from '@getalby/bitcoin-connect-react';
import { requestProvider } from '@getalby/bitcoin-connect';

import { launchModal } from '@getalby/bitcoin-connect';

export default function Lightning() {
    useEffect(() => {
        // Initialize Bitcoin Connect
        // init({
        //     appName: 'My Lightning App', // your app name
        //     // filters: ["nwc"],
        //     // showBalance: true,
        //     // providerConfig: {
        //     //   nwc: {
        //     //     authorizationUrlOptions: {
        //     //       requestMethods: ['get_balance', 'make_invoice', 'lookup_invoice'],
        //     //     },
        //     //   },
        //     // }
        // });
    }, [])


    const handleRequest = async () => {
        // launchModal();

        const provider = await requestProvider();
        // await provider.sendPayment('lnbc...');
    }

    return (
        <div className="min-h-screen w-full relative bg-black text-white">
            <Navbar />
            <p>Lightning</p>

            <button onClick={handleRequest}>Launch lightning</button>
            <div className="flex flex-col desktop:gap-y-[80px] gap-y-[50px] mt-[50px] desktop:mt-[180px]">
            </div>
            <Footer />
        </div>
    );
}
