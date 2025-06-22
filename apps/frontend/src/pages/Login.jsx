import React from 'react'
import '../App.css'
function Login() {
    return (
        <div id='main' className='w-screen min-h-screen bg-[#101813] flex justify-center items-center'>
            <div id='container' className='md:w-[80%] md:h-[85%] w-[90%] min-h-full bg-[#121c16] rounded-lg flex md:justify-between md:flex-row flex-col md:gap-50 gap-10 py-10 md:py-5'>
            <div id='left' className='md:w-[55%] w-full min-h-full flex flex-col md:px-10 md:py-5 px-4 py-3 mb-5 md:mb-0 items-center md:items-start'>
                <div  className='w-60 h-10 text-[#0da850] rounded-full bg-[#101813] border-1 border-[#35c56a69] flex justify-center items-center '>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles w-4 h-4 text-primary cz-color-4825622 cz-color-3813676"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" class="cz-color-4825622 cz-color-3813676"></path><path d="M20 3v4" class="cz-color-4825622 cz-color-3813676"></path><path d="M22 5h-4" class="cz-color-4825622 cz-color-3813676"></path><path d="M4 17v2" class="cz-color-4825622 cz-color-3813676"></path><path d="M5 18H3" class="cz-color-4825622 cz-color-3813676"></path></svg>
                    <h1 className=' text-sm ml-2'>AI Powered Database Assistant</h1>
                </div>
               
               <div className='w-full h-auto pt-8'>
                <h1 className='md:text-8xl text-5xl font-bold text-white tracking-wide'>Mongo<span className='text-[#3CBC6B]'>Pilot</span></h1>
                <p className='text-gray-400 md:text-2xl text-sm md:mt-10 mt-5 leading-relaxed'>Transform your database interactions with intelligent natural language processing. Query, analyze, and manage your MongoDB databases like never before.</p>
                <div id='left-containers' className='w-full h-auto flex gap-5 md:mt-12 mt-8 md:flex-row flex-col'>
                <div className='w-full h-auto flex flex-col gap-5'>
                <div className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300'></div>
                <div className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300'></div>
                </div>
                <div className='w-full h-auto flex flex-col gap-5'>
                <div className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300'></div>
                <div className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300'></div>
                </div>
                </div>
               </div>
            </div>
            {/* <div id='divider-desktop' className='w-[2px] h-150 bg-[#23533784] hidden md:block rounded-full m-auto'></div>
            <div id='divider-mobile' className='w-[90%] h-[2px] bg-[#23533784] md:hidden rounded-full m-auto'></div> */}
            <div id='right' className='md:w-[48%] w-full h-auto flex justify-center items-center md:px-10 md:py-5 px-0 py-3'>
                <div className='md:w-[95%] w-full h-130  bg-[#17211b] bg-[#121c16] rounded-3xl  hover:bg-[#17241c] md:hover:scale-102 transition-all duration-300' ></div>
            </div>
            </div>
         </div>
    )
}
export default Login