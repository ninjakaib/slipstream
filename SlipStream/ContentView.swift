//
//  ContentView.swift
//  SlipStream
//
//  Created by Kai Breese on 5/28/26.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = SlipStreamViewModel()

    var body: some View {
        AppRootView()
            .environmentObject(viewModel)
    }
}

#Preview {
    ContentView()
}
